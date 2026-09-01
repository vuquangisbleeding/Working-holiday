import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { isCaptcha, logCaptchaInfo, pauseForCaptcha, readCaptchaInfo, recaptchaNeedsUser } from "./captcha.ts";
import { CAPTCHA_POLL_SECONDS, NEXT_LOCATORS, SAVE_LOCATORS, SUBMIT_LOCATORS } from "./constants.ts";
import { fillDeclaration } from "./declaration.ts";
import { waiter, waitReady } from "./driver.ts";
import { dumpUnknownFields, findClickable } from "./elements.ts";
import { isTimeoutError, isWebdriverError } from "./errors.ts";
import { maybeWaitPostback } from "./fill.ts";
import { log, stats, withStuck } from "./logger.ts";
import { findPayLater, findLabeled, findPaymentGateway, isHighLoad, isPayLaterPage } from "./page.ts";
import { recoverHighLoad } from "./recover.ts";
import { formatDuration, nowSec, sleep } from "./time.ts";

async function waitRecaptchaBeforeSubmit(driver: WebDriver): Promise<void> {
  if (!(await recaptchaNeedsUser(driver))) return;
  logCaptchaInfo(await readCaptchaInfo(driver));
  const started = nowSec();
  log().pause("CAPTCHA", "Trang Submit có reCAPTCHA. Hãy tick/giải captcha trên Chrome, bot sẽ bấm SUBMIT sau.");
  while ((await recaptchaNeedsUser(driver)) && !(await isCaptcha(driver))) {
    try {
      await fillDeclaration(driver, true);
    } catch {
      // keep polling
    }
    await sleep(CAPTCHA_POLL_SECONDS);
  }
  if (await isCaptcha(driver)) await pauseForCaptcha(driver);
  const duration = nowSec() - started;
  stats().add_captcha(duration);
  log().ok(
    "CAPTCHA",
    `Bạn giải captcha trong ${formatDuration(duration)} (lần ${stats().captcha_count}). ` +
      `Tổng captcha: ${formatDuration(stats().captcha_total)}`,
    duration,
  );
}

export async function clickControl(
  driver: WebDriver,
  locators: By[],
  label: string,
  doneWhen?: (d: WebDriver) => boolean | Promise<boolean>,
): Promise<void> {
  const wait = waiter(driver);
  const control = await findClickable(driver, locators);
  if (!control) throw new Error(`${label} button not found`);

  const beforeUrl = await driver.getCurrentUrl();
  const started = nowSec();
  log().info(label, `Từ ${beforeUrl}`);
  try {
    await control.click();
  } catch {
    await driver.executeScript("arguments[0].click();", control);
  }
  try {
    await wait.until(until.stalenessOf(control));
  } catch (err) {
    if (!(isTimeoutError(err) || isWebdriverError(err))) throw err;
  }
  await waitReady(driver);
  await pauseForCaptcha(driver);

  try {
    await withStuck(label + " chờ chuyển trang", async () => {
      await wait.until(async (d: WebDriver) => {
        if ((await d.getCurrentUrl()) !== beforeUrl || (await isCaptcha(d)) || (await isHighLoad(d))) return true;
        return Boolean(doneWhen && (await doneWhen(d)));
      });
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      const errors: string[] = [];
      for (const el of await driver.findElements(By.css(".ErrorMessageSmall, [id*='Error'], .validation-summary-errors"))) {
        if (await el.isDisplayed()) {
          const text = (await el.getText()).trim();
          if (text) errors.push(text);
        }
      }
      throw new Error(`${label} did not leave ${beforeUrl}. Validation: ${errors.slice(0, 8)}`);
    }
    throw err;
  }
  await pauseForCaptcha(driver);
  await recoverHighLoad(driver);
  log().ok(label, `Sang ${await driver.getCurrentUrl()}`, nowSec() - started);
}

export async function clickNext(driver: WebDriver): Promise<string> {
  if (await findClickable(driver, NEXT_LOCATORS)) {
    await clickControl(driver, NEXT_LOCATORS, "NEXT");
    return driver.getCurrentUrl();
  }

  const saved = await clickSaveIfPresent(driver);
  if (saved) {
    log().info("NEXT", "Không có nút Next — đã bấm SAVE");
    const before = await driver.getCurrentUrl();
    const deadline = nowSec() + 10;
    while (nowSec() < deadline) {
      if (await findClickable(driver, NEXT_LOCATORS)) {
        log().info("NEXT", "Next xuất hiện sau SAVE — bấm Next");
        await clickControl(driver, NEXT_LOCATORS, "NEXT");
        return driver.getCurrentUrl();
      }
      if ((await driver.getCurrentUrl()) !== before) {
        log().ok("SAVE", `SAVE đã chuyển trang → ${await driver.getCurrentUrl()}`);
        return driver.getCurrentUrl();
      }
      await sleep(250);
    }
    log().info("SAVE", "Đã SAVE, chưa thấy Next — tiếp tục");
    return driver.getCurrentUrl();
  }

  if (await findClickable(driver, SUBMIT_LOCATORS)) {
    log().info("NEXT", "Không có Next/SAVE — bấm SUBMIT");
    await clickSubmit(driver);
    return driver.getCurrentUrl();
  }

  throw new Error("Không có nút Next, SAVE hoặc SUBMIT");
}

export async function clickSubmit(driver: WebDriver): Promise<string> {
  await waitRecaptchaBeforeSubmit(driver);
  if (await isPayLaterPage(driver)) {
    log().info("SUBMIT", "Đã sang trang Submit Received — bỏ qua SUBMIT");
    return "pay_now";
  }
  try {
    await clickControl(
      driver,
      SUBMIT_LOCATORS,
      "SUBMIT",
      isPayLaterPage,
    );
  } catch (err) {
    if (err instanceof Error && !isTimeoutError(err) && !isWebdriverError(err)) {
      if (await isPayLaterPage(driver)) {
        log().info("SUBMIT", "Không còn nút SUBMIT — đang ở trang PAY NOW");
        return "pay_now";
      }
      await dumpUnknownFields(driver, "submit");
    }
    throw err;
  }
  return (await isPayLaterPage(driver)) ? "pay_now" : "ok";
}

async function clickFound(
  driver: WebDriver,
  control: WebElement,
  label: string,
  goneWhen?: (d: WebDriver) => Promise<boolean>,
): Promise<void> {
  const beforeUrl = await driver.getCurrentUrl();
  const started = nowSec();
  log().info(label, `Từ ${beforeUrl}`);
  try {
    await control.click();
  } catch {
    await driver.executeScript("arguments[0].click();", control);
  }
  const wait = waiter(driver);
  try {
    await wait.until(until.stalenessOf(control));
  } catch (err) {
    if (!(isTimeoutError(err) || isWebdriverError(err))) throw err;
  }
  await waitReady(driver);
  await pauseForCaptcha(driver);
  try {
    await withStuck(label + " chờ chuyển trang", async () => {
      await wait.until(async (d: WebDriver) => {
        if ((await d.getCurrentUrl()) !== beforeUrl || (await isCaptcha(d)) || (await isHighLoad(d))) return true;
        return Boolean(goneWhen && (await goneWhen(d)));
      });
    });
  } catch (err) {
    if (isTimeoutError(err)) log().info(label, "Đã bấm (trang không đổi URL ngay)");
    else throw err;
  }
  await pauseForCaptcha(driver);
  await recoverHighLoad(driver);
  log().ok(label, `Sang ${await driver.getCurrentUrl()}`, nowSec() - started);
}

export async function clickPayNow(driver: WebDriver): Promise<void> {
  await waiter(driver).until(async (d: WebDriver) => (await findLabeled(d, ["PAY NOW"], ["PAY LATER"])) !== null);
  const control = await findLabeled(driver, ["PAY NOW"], ["PAY LATER"]);
  if (!control) {
    await dumpUnknownFields(driver, "pay_now");
    throw new Error("PAY NOW button not found");
  }
  await clickFound(driver, control, "PAY_NOW", async (d) => (await findLabeled(d, ["PAY NOW"], ["PAY LATER"])) === null);
}

export async function clickNextStep(driver: WebDriver): Promise<void> {
  await waiter(driver).until(async (d: WebDriver) => (await findPaymentGateway(d)) !== null);
  const control = await findPaymentGateway(driver);
  if (!control) {
    await dumpUnknownFields(driver, "next_step");
    throw new Error("Payment gateway link (onlinePaymentAnchor2) not found");
  }
  await clickFound(driver, control, "NEXT_STEP");
}

export async function clickOk(driver: WebDriver): Promise<void> {
  const control = await findLabeled(driver, ["OK"], ["PAY NOW", "PAY LATER", "NEXT STEP"]);
  if (!control) throw new Error("OK button not found");
  await clickFound(driver, control, "OK");
}

export async function clickPayLater(driver: WebDriver): Promise<void> {
  await waiter(driver).until(async (d: WebDriver) => (await findPayLater(d)) !== null);
  const control = await findPayLater(driver);
  if (!control) {
    await dumpUnknownFields(driver, "pay_later");
    throw new Error("PAY LATER button not found");
  }
  await clickFound(driver, control, "PAY_LATER", async (d) => (await findPayLater(d)) === null);
}

export async function clickSaveIfPresent(driver: WebDriver): Promise<boolean> {
  const control = await findClickable(driver, SAVE_LOCATORS);
  if (!control) return false;
  const started = nowSec();
  log().info("SAVE", await driver.getCurrentUrl());
  try {
    await control.click();
  } catch {
    await driver.executeScript("arguments[0].click();", control);
  }
  await maybeWaitPostback(driver, control);
  await waitReady(driver);
  await pauseForCaptcha(driver);
  log().ok("SAVE", "Đã lưu trang hiện tại", nowSec() - started);
  return true;
}
