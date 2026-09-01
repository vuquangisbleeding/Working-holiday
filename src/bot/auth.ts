import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { pauseForCaptcha, isCaptcha } from "./captcha.ts";
import { AUTH_ERROR_ID, LOGIN_URL } from "./constants.ts";
import { waiter, waitReady } from "./driver.ts";
import { log, stats } from "./logger.ts";
import { nowSec } from "./time.ts";

export async function login(driver: WebDriver, username: string, password: string): Promise<void> {
  const wait = waiter(driver);
  stats().login_started_at = nowSec();
  log().info("LOGIN", `Mở ${LOGIN_URL}`);
  await driver.get(LOGIN_URL);
  await pauseForCaptcha(driver);

  const usernameInput = (await wait.until(until.elementLocated(By.name("username")))) as WebElement;
  await wait.until(until.elementIsVisible(usernameInput));
  await wait.until(async () => (await usernameInput.isDisplayed()) && (await usernameInput.isEnabled()));
  await usernameInput.clear();
  await usernameInput.sendKeys(username);

  const passwordInput = (await wait.until(until.elementLocated(By.name("password")))) as WebElement;
  await wait.until(until.elementIsVisible(passwordInput));
  await wait.until(async () => (await passwordInput.isDisplayed()) && (await passwordInput.isEnabled()));
  await passwordInput.clear();
  await passwordInput.sendKeys(password);

  const loginButton = (await wait.until(
    until.elementLocated(By.css('input.button-large-primary[type="submit"][value="LOGIN"]')),
  )) as WebElement;
  await wait.until(until.elementIsVisible(loginButton));
  await wait.until(async () => (await loginButton.isDisplayed()) && (await loginButton.isEnabled()));
  log().info("LOGIN", "Bấm LOGIN");
  await loginButton.click();

  await wait.until(async (d: WebDriver) => {
    const errors = await d.findElements(By.id(AUTH_ERROR_ID));
    for (const el of errors) {
      if ((await el.isDisplayed()) && (await el.getText()).trim()) return true;
    }
    try {
      await usernameInput.getTagName();
      return false;
    } catch {
      return true;
    }
  });
  await waitReady(driver);
  await pauseForCaptcha(driver);

  const errors = await driver.findElements(By.id(AUTH_ERROR_ID));
  let loginFailed = false;
  let loginMessage = "";
  for (const el of errors) {
    const text = (await el.getText()).trim();
    if ((await el.isDisplayed()) && text) loginFailed = true;
    if (!loginMessage && text) loginMessage = text;
  }
  if (loginFailed) throw new Error(`Login failed: ${loginMessage}`);

  await wait.until(async (d: WebDriver) => {
    const url = await d.getCurrentUrl();
    return url.includes("/WorkingHoliday/") || url.includes("aspxerrorpath") || (await isCaptcha(d));
  });
  await pauseForCaptcha(driver);
  const afterUrl = await driver.getCurrentUrl();
  if (afterUrl.includes("aspxerrorpath") || afterUrl.includes("formshelp/error")) {
    log().info("LOGIN", "Trang lỗi sau login, thử lại homepage");
    await driver.get("https://onlineservices.immigration.govt.nz/WorkingHoliday/");
    await waitReady(driver);
    await pauseForCaptcha(driver);
    await wait.until(until.urlContains("/WorkingHoliday/"));
  }
  log().ok("LOGIN", await driver.getCurrentUrl());
}
