import { By, until, type WebDriver } from "selenium-webdriver";
import { applicant, loadCredentials } from "./applicant.ts";
import { login } from "./auth.ts";
import { pauseForCaptcha } from "./captcha.ts";
import { APPLY_NOW_ID, COUNTRY_NAME_CSS, EDIT_LINK_CSS } from "./constants.ts";
import { waiter, waitReady } from "./driver.ts";
import { clickAndWaitStale, clickWhenReady, hasSuffix, pageHasAny } from "./elements.ts";
import { log } from "./logger.ts";
import { raiseIfQuotaClosed } from "./page.ts";

function applicationIdFromUrl(href: string): string | null {
  try {
    const parsed = new URL(href);
    return parsed.searchParams.get("ApplicationId") ?? parsed.searchParams.get("applicationId");
  } catch {
    return null;
  }
}

export async function goToPersonal1(driver: WebDriver): Promise<void> {
  const appId = applicationIdFromUrl(await driver.getCurrentUrl());
  if (!appId || (await driver.getCurrentUrl()).includes("Personal1.aspx")) return;
  const target =
    "https://onlineservices.immigration.govt.nz/WorkingHoliday/Wizard/" +
    `Personal1.aspx?ApplicationId=${appId}&IndividualType=Primary&IndividualIndex=1`;
  log().info("GOTO_PERSONAL1", target);
  await driver.get(target);
  await waitReady(driver);
  await pauseForCaptcha(driver);
}

export async function selectCountry(driver: WebDriver, country: string): Promise<void> {
  const wait = waiter(driver);
  await waitReady(driver);
  await wait.until(until.elementLocated(By.css(COUNTRY_NAME_CSS)));
  const countrySpan =
    "//span[starts-with(@id,'ContentPlaceHolder1_countryRepeater_countryName_')" +
    ` and normalize-space()='${country}']`;
  log().info("SELECT_COUNTRY", country);
  const countryEl = await clickWhenReady(
    driver,
    wait,
    By.xpath(`${countrySpan}/ancestor::div[contains(@class,'category-item-footer')]`),
  );
  await wait.until(until.stalenessOf(countryEl));
  await waitReady(driver);
  await pauseForCaptcha(driver);
}

export async function clickApplyNow(driver: WebDriver): Promise<void> {
  await clickAndWaitStale(driver, By.id(APPLY_NOW_ID), "APPLY_NOW Bấm APPLY NOW");
}

export async function openExistingApplication(driver: WebDriver): Promise<void> {
  await clickAndWaitStale(driver, By.css(EDIT_LINK_CSS), "OPEN_EXISTING Mở hồ sơ Incomplete có sẵn");
}

export async function continueToApplication(driver: WebDriver): Promise<void> {
  const wait = waiter(driver);
  await waitReady(driver);
  await pauseForCaptcha(driver);
  await wait.until(
    async (d: WebDriver) =>
      (await pageHasAny(
        d,
        By.css(COUNTRY_NAME_CSS),
        By.id(APPLY_NOW_ID),
        By.css(EDIT_LINK_CSS),
        By.css("[id$='familyNameTextBox']"),
        By.css("[id*='Wizard']"),
      )) || (await d.getCurrentUrl()).includes("Wizard/"),
  );

  if ((await driver.getCurrentUrl()).includes("Wizard/") || (await hasSuffix(driver, "familyNameTextBox"))) {
    log().info("WIZARD", "Đã ở trong form hồ sơ");
    await goToPersonal1(driver);
    return;
  }

  await raiseIfQuotaClosed(driver);

  if ((await driver.findElements(By.css(EDIT_LINK_CSS))).length) {
    await openExistingApplication(driver);
    await goToPersonal1(driver);
    return;
  }
  if ((await driver.findElements(By.id(APPLY_NOW_ID))).length) {
    await clickApplyNow(driver);
    await goToPersonal1(driver);
    return;
  }
  if ((await driver.findElements(By.css(COUNTRY_NAME_CSS))).length) {
    await selectCountry(driver, applicant().scheme_country ?? "CROATIA");
    await clickApplyNow(driver);
    await goToPersonal1(driver);
    return;
  }
  throw new Error("Could not find Japan, APPLY NOW, or an existing application.");
}

export async function resumeSession(driver: WebDriver): Promise<void> {
  const [username, password] = loadCredentials();
  log().info("RESUME", "Session hết hạn — login lại rồi mở hồ sơ Incomplete (không APPLY NOW)");
  await login(driver, username, password);
  await continueToApplication(driver);
}
