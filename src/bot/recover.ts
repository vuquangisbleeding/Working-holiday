import type { WebDriver } from "selenium-webdriver";
import { pauseForCaptcha } from "./captcha.ts";
import { waitReady } from "./driver.ts";
import { resumeSession } from "./entry.ts";
import { isWebdriverError } from "./errors.ts";
import { log } from "./logger.ts";
import { isHighLoad, isLoginScreen, raiseIfQuotaClosed } from "./page.ts";
import { sleep } from "./time.ts";

export async function recoverHighLoad(driver: WebDriver): Promise<boolean> {
  let recovered = false;
  let tries = 0;
  while (await isHighLoad(driver)) {
    await raiseIfQuotaClosed(driver);
    tries += 1;
    const inApp = (await driver.getCurrentUrl()).toLowerCase().includes("applicationid=");
    const waitS = tries === 1 ? 0 : inApp ? Math.min(0.4 * tries, 3.0) : Math.min(0.8 * tries, 5.0);
    log().pause(
      "HIGH_LOAD",
      waitS
        ? `INZ quá tải. Đợi ${waitS.toFixed(1)}s rồi F5 (lần ${tries})...`
        : `INZ quá tải. F5 ngay (lần ${tries})...`,
    );
    if (waitS > 0) await sleep(waitS * 1000);
    const url = await driver.getCurrentUrl();
    try {
      await driver.navigate().refresh();
    } catch (err) {
      if (isWebdriverError(err)) {
        try {
          await driver.executeScript("location.reload()");
        } catch {
          await driver.get(url);
        }
      } else throw err;
    }
    await waitReady(driver);
    await pauseForCaptcha(driver);
    recovered = true;
    if (await isLoginScreen(driver)) {
      await resumeSession(driver);
      break;
    }
    await raiseIfQuotaClosed(driver);
  }
  return recovered;
}
