import path from "path";
import { fileURLToPath } from "url";
import { loadApplicant, loadCredentials, setApplicant, applicant } from "./applicant.ts";
import { login } from "./auth.ts";
import { ROOT } from "./constants.ts";
import { createDriver } from "./driver.ts";
import { continueToApplication } from "./entry.ts";
import { initRun, log, stats } from "./logger.ts";
import { formatDuration } from "./time.ts";
import { applicantIdentityLines } from "../telegram/identity.ts";
import { sendTelegramText } from "../telegram/bot.ts";
import { walkWizard } from "./wizard.ts";

function logRunSummary(finalUrl = ""): void {
  const total = stats().elapsed();
  const captchaT = stats().captcha_total;
  const url = finalUrl ? ` | URL: ${finalUrl}` : "";
  log().ok(
    "SUMMARY",
    `Tổng thời gian từ đăng nhập đến trang cuối: ${formatDuration(total)} ` +
      `(bot ${formatDuration(Math.max(0, total - captchaT))} + captcha ${formatDuration(captchaT)}, ` +
      `${stats().captcha_count} lần)${url}`,
    total,
  );
}

export async function main(): Promise<void> {
  const { log: runLog } = initRun(ROOT);
  setApplicant(loadApplicant());
  runLog.info("START", `Data file=${path.join(ROOT, "applicant.json")} | Log=${runLog.path}`);

  const [username, password] = loadCredentials();
  const driver = await createDriver();
  let finalUrl = "";
  try {
    await login(driver, username, password);
    await continueToApplication(driver);
    await walkWizard(driver);
    try {
      finalUrl = await driver.getCurrentUrl();
    } catch {
      // keep empty
    }
    runLog.ok("DONE", `URL cuối: ${finalUrl}`);
    logRunSummary(finalUrl);
    const total = stats().elapsed();
    const captchaT = stats().captcha_total;
    const telegram = await sendTelegramText(
      [
        "NZ WHS xong",
        ...applicantIdentityLines(applicant()),
        `Tổng ${formatDuration(total)} (bot ${formatDuration(Math.max(0, total - captchaT))} + captcha ${formatDuration(captchaT)}, ${stats().captcha_count} lần)`,
        finalUrl || "(chưa có URL)",
      ].join("\n"),
    );
    if (telegram.ok) runLog.ok("TELEGRAM", "Đã gửi Telegram");
    else if (telegram.error) runLog.info("TELEGRAM", telegram.error);
    runLog.info("BROWSER", "Chrome vẫn mở. Log: " + runLog.path);
  } catch (exc) {
    if (exc instanceof Error) {
      runLog.error("FAIL", String(exc));
      try {
        finalUrl = await driver.getCurrentUrl();
        runLog.error("FAIL_URL", finalUrl);
      } catch {
        // ignore
      }
      logRunSummary(finalUrl);
    }
    throw exc;
  }
}

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]!);

if (isEntrypoint) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
