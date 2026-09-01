import path from "path";
import { fileURLToPath } from "url";
import { By } from "selenium-webdriver";

export const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
export const LOGIN_URL = "https://onlineservices.immigration.govt.nz/?WHS";
export const WAIT_SECONDS = 30_000;
export const WAIT_POLL = 100;
export const CAPTCHA_POLL_SECONDS = 2_000;
export const POSTBACK_DETECT_SECONDS = 80;
export const POSTBACK_WAIT_SECONDS = 15_000;
export const AUTH_ERROR_ID = "authenticationErrorLabel";
export const APPLY_NOW_ID = "ContentPlaceHolder1_applyNowButton";
export const COUNTRY_NAME_CSS = "[id^='ContentPlaceHolder1_countryRepeater_countryName_']";
export const EDIT_LINK_CSS =
  "a[id^='ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_']";
export const MAX_WIZARD_PAGES = 14;
export const NEXT_LOCATORS: By[] = [
  By.css("[id$='nextImageButton']"),
  By.css("[id$='NextButton']"),
  By.css("input[value='Next']"),
  By.xpath("//input[@value='Next']"),
  By.xpath("//button[normalize-space()='Next']"),
  By.css("input[alt='Next']"),
];
export const SAVE_LOCATORS: By[] = [
  By.css("input[value='SAVE']"),
  By.css("input.button-large-primary[value='SAVE']"),
  By.css("input[id$='validateButton'][value='SAVE']"),
  By.xpath("//input[translate(@value,'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ')='SAVE']"),
  By.xpath("//button[normalize-space()='SAVE']"),
  By.xpath("//a[normalize-space()='SAVE']"),
];
export const SUBMIT_LOCATORS: By[] = [
  By.css("[id$='submitImageButton']"),
  By.css("[id$='submitButton']"),
  By.css("input[value='SUBMIT']"),
  By.xpath("//input[@value='SUBMIT']"),
  By.xpath("//input[translate(@value,'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ')='SUBMIT']"),
  By.xpath("//button[normalize-space()='SUBMIT']"),
];
export const DECL_CHECKBOX_SUFFIXES = [
  "falseStatementCheckBox",
  "notesCheckBox",
  "circumstancesCheckBox",
  "warrantsCheckBox",
  "informationCheckBox",
  "healthCheckBox",
  "adviceCheckBox",
  "registrationCheckBox",
  "entitlementCheckbox",
  "entitlementCheckBox",
  "permitExpiryCheckBox",
  "medicalInsuranceCheckBox",
] as const;
