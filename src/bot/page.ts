import { By, type WebDriver, type WebElement } from "selenium-webdriver";
import { isCaptcha, pauseForCaptcha } from "./captcha.ts";
import { hasSuffix } from "./elements.ts";
import { isWebdriverError } from "./errors.ts";

export async function findPayLater(driver: WebDriver): Promise<WebElement | null> {
  try {
    return (await driver.executeScript(`
      const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toUpperCase();
      const nodes = Array.from(document.querySelectorAll('input, button, a, img'));
      for (const el of nodes) {
        const id = (el.id || '').toLowerCase();
        const val = norm(el.value);
        const text = norm(el.textContent);
        const title = norm(el.title || el.alt);
        const hit = val === 'PAY LATER' || text === 'PAY LATER' || title === 'PAY LATER'
          || val.includes('PAY LATER') || text.includes('PAY LATER')
          || id.includes('paylater') || id.includes('pay_later') || id.includes('pay-later');
        if (!hit) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        return el;
      }
      return null;
    `)) as WebElement | null;
  } catch (err) {
    if (isWebdriverError(err)) return null;
    throw err;
  }
}

export async function findLabeled(
  driver: WebDriver,
  labels: string[],
  exclude: string[] = [],
): Promise<WebElement | null> {
  try {
    return (await driver.executeScript(
      `
      const labels = arguments[0];
      const exclude = arguments[1];
      const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toUpperCase();
      const nodes = Array.from(document.querySelectorAll('input, button, a, span'));
      for (const el of nodes) {
        const blob = [el.value, el.textContent, el.id, el.title, el.alt].map(norm).join(' ');
        if (exclude.some((x) => blob.includes(x))) continue;
        if (!labels.some((l) => blob.includes(l))) continue;
        const target = el.closest('a, button, input') || el;
        const st = window.getComputedStyle(target);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        if (target.offsetWidth + target.offsetHeight === 0) continue;
        if (target.disabled) continue;
        return target;
      }
      return null;
      `,
      labels.map((l) => l.toUpperCase()),
      exclude.map((e) => e.toUpperCase()),
    )) as WebElement | null;
  } catch (err) {
    if (isWebdriverError(err)) return null;
    throw err;
  }
}

export async function isCardGateway(driver: WebDriver): Promise<boolean> {
  const url = (await driver.getCurrentUrl()).toLowerCase();
  if (/paystation|paymark|paymentexpress|pxpay/.test(url)) return true;
  try {
    return Boolean(
      await driver.executeScript(`
        return !!(
          document.querySelector("[autocomplete='cc-number'], input[id*='cardNumber'], input[name*='cardNumber']") ||
          document.querySelector("iframe[src*='paystation'], iframe[src*='paymark'], iframe[src*='paymentexpress']")
        );
      `),
    );
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}

export async function hasPayerNameField(driver: WebDriver): Promise<boolean> {
  return hasSuffix(driver, "payerNameTextBox", "PayerNameTextBox", "payerName");
}

export async function findPaymentGateway(driver: WebDriver): Promise<WebElement | null> {
  try {
    return (await driver.executeScript(`
      return document.getElementById('ContentPlaceHolder1_onlinePaymentAnchor2')
        || document.querySelector("a[id$='onlinePaymentAnchor2']")
        || document.querySelector("a[href*='PaymentGateway/OnLinePayment']")
        || document.querySelector("a[href*='OnLinePayment.aspx']");
    `)) as WebElement | null;
  } catch (err) {
    if (isWebdriverError(err)) return null;
    throw err;
  }
}

export async function isPayNextPage(driver: WebDriver): Promise<boolean> {
  const url = (await driver.getCurrentUrl()).toLowerCase();
  if (url.includes("onlinepayment.aspx") && !url.includes("paymentgateway")) return true;
  if (await findPaymentGateway(driver)) return true;
  const text = await pageText(driver);
  return text.includes("next step") && (text.includes("secure payment") || text.includes("total charge"));
}

export async function isPayLaterPage(driver: WebDriver): Promise<boolean> {
  const url = (await driver.getCurrentUrl()).toLowerCase();
  if (url.includes("submitreceived") || url.includes("onlinesubmit")) return true;
  if (url.includes("submit.aspx") && url.includes("token=")) return true;
  if ((await findPayLater(driver)) !== null) return true;
  try {
    const body = (await driver.findElement(By.tagName("body")).getText()).toUpperCase();
    return body.includes("SUBMIT RECEIVED") && body.includes("PAY LATER");
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}

export async function pageText(driver: WebDriver): Promise<string> {
  try {
    const blob = (await driver.executeScript(`
      const root = document.documentElement;
      return [
        document.title || '',
        document.body ? (document.body.innerText || document.body.textContent || '') : '',
        root ? (root.innerText || root.textContent || '') : '',
      ].join(' ');
    `)) as string;
    return String(blob || "").toLowerCase();
  } catch (err) {
    if (isWebdriverError(err)) return "";
    throw err;
  }
}

export async function isHighLoad(driver: WebDriver): Promise<boolean> {
  const text = await pageText(driver);
  if (
    text.includes("site is under high load") ||
    text.includes("high demand on the system") ||
    text.includes("experiencing high demand") ||
    (text.includes("high load") && text.includes("try again later"))
  ) {
    return true;
  }
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact.includes("try again later")) return false;
  const leftover = compact
    .replace(/please try again later\.?/g, "")
    .replace(/try again later\.?/g, "")
    .replace(/new zealand immigration/g, "")
    .replace(/immigration new zealand/g, "")
    .trim();
  return leftover.length < 160;
}

export async function isQuotaClosed(driver: WebDriver): Promise<boolean> {
  const text = await pageText(driver);
  return [
    "no places available",
    "no places left",
    "no places remaining",
    "quota has been filled",
    "quota is filled",
    "places have been filled",
    "all places have been taken",
    "applications are no longer being accepted",
    "no longer accepting applications",
    "no longer being accepted",
  ].some((n) => text.includes(n));
}

export async function isLoginScreen(driver: WebDriver): Promise<boolean> {
  try {
    const users = await driver.findElements(By.name("username"));
    const passwords = await driver.findElements(By.name("password"));
    return Boolean(users.length && passwords.length);
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}

export async function raiseIfQuotaClosed(driver: WebDriver): Promise<void> {
  if (!(await isQuotaClosed(driver))) return;
  throw new Error(
    "Scheme đã hết chỗ hoặc đóng. Hồ sơ Incomplete không giữ slot — " +
      "không thể lấy lại chỗ đã mất. Chỉ nộp được khi scheme mở lại.",
  );
}

export async function detectPage(driver: WebDriver): Promise<string> {
  if (!(await hasSuffix(driver, "falseStatementCheckBox"))) {
    await pauseForCaptcha(driver);
  }
  await raiseIfQuotaClosed(driver);
  const url = await driver.getCurrentUrl();
  if ((await isLoginScreen(driver)) && !url.includes("Wizard/")) return "login";
  if (await isHighLoad(driver)) return "highload";
  if (await isCardGateway(driver)) return "payment";
  if (await hasPayerNameField(driver)) return "payer";
  if (await isPayNextPage(driver)) return "pay_next";
  if (await isPayLaterPage(driver)) return "pay_now";
  if (url.includes("Submit.aspx") || (await hasSuffix(driver, "falseStatementCheckBox"))) return "declaration";
  if (await isCaptcha(driver)) return "captcha";
  if (url.includes("Personal1.aspx") || (await hasSuffix(driver, "familyNameTextBox"))) return "personal1";
  if (url.includes("Personal2.aspx") || (await hasSuffix(driver, "passportNumberTextBox"))) return "personal2";
  if (url.includes("Personal3.aspx")) return "personal3";
  if (url.includes("Medical1.aspx") || url.includes("Health") || (await hasSuffix(driver, "renalDialysisDropDownList"))) {
    return "health";
  }
  if (url.includes("Character.aspx") || (await hasSuffix(driver, "imprisonment5YearsDropDownList"))) {
    return "character";
  }
  if (
    url.includes("WorkingHolidaySpecific.aspx") ||
    (await hasSuffix(
      driver,
      "previousWhsPermitVisaDropDownList",
      "sufficientFundsHolidayDropDownList",
      "intendedTravelDateDatePicker_DatePicker",
    ))
  ) {
    return "whs";
  }
  const submits = await driver.findElements(By.css("input[value='SUBMIT']"));
  const nexts = await driver.findElements(By.css("[id$='nextImageButton'], input[value='Next']"));
  if (submits.length && !nexts.length) return "declaration";
  return "unknown";
}
