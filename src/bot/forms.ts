import { By, until, type WebDriver } from "selenium-webdriver";
import { DEFAULT_WHS } from "../types.ts";
import { applicant } from "./applicant.ts";
import { waiter } from "./driver.ts";
import { fillMany, job, setSelectMaybePostback } from "./fill.ts";
import { log } from "./logger.ts";
import { nowSec } from "./time.ts";

export async function fillPersonal1(driver: WebDriver): Promise<void> {
  const wait = waiter(driver);
  await wait.until(until.elementLocated(By.css("[id$='familyNameTextBox']")));
  const { personal, address, contact } = applicant();
  const started = nowSec();
  await setSelectMaybePostback(driver, String(contact.has_agent), "representedByAgentDropdownlist");
  await wait.until(until.elementLocated(By.css("[id$='familyNameTextBox']")));
  await fillMany(driver, [
    job("text", personal.family_name, ["familyNameTextBox"]),
    job("text", personal.given_name_1, ["givenName1Textbox", "givenName1TextBox"]),
    job("text", personal.given_name_2 ?? "", ["givenName2Textbox", "givenName2TextBox"], true),
    job("text", personal.given_name_3 ?? "", ["givenName3Textbox", "givenName3TextBox"], true),
    job("text", personal.other_names ?? "", ["otherNamesTextBox"], true),
    job("select", personal.title, ["titleDropDownList"]),
    job("text", personal.other_title ?? "", ["otherTitleTextBox"], true),
    job("select", personal.gender, ["genderDropDownList"]),
    job("text", personal.date_of_birth, ["dateOfBirthDatePicker_DatePicker"]),
    job("select", personal.country_of_birth, ["personDetails_CountryDropDownList"]),
    job("text", address.street_number, ["streetNumberTextbox", "streetNumberTextBox"]),
    job("text", address.street_name, ["address1TextBox"]),
    job("text", address.suburb, ["suburbTextBox"]),
    job("text", address.city, ["cityTextBox"]),
    job("text", address.province, ["provinceStateTextBox"]),
    job("text", address.postal_code, ["postalCodeTextBox"]),
    job("select", address.country, ["address_countryDropDownList"]),
    job("text", contact.phone_daytime ?? "", ["phoneNumberTextBox"], true),
    job("text", contact.phone_night ?? "", ["phoneNumberNightTextBox"], true),
    job("text", contact.phone_mobile, ["phoneNumberMobileTextBox"]),
    job("text", contact.fax ?? "", ["faxNumberTextbox", "faxNumberTextBox"], true),
    job("text", contact.email, ["emailAddressTextBox"]),
    job("select", contact.communication_method, ["communicationMethodDropDownList"]),
    job("select", String(contact.has_credit_card), ["hasCreditCardDropDownlist"]),
  ]);
  log().ok("FILL_PERSONAL1", "Tên, địa chỉ, liên hệ", nowSec() - started);
}

export async function fillIdentification(driver: WebDriver): Promise<void> {
  await waiter(driver).until(until.elementLocated(By.css("[id$='passportNumberTextBox']")));
  const ident = applicant().identification;
  const started = nowSec();
  await fillMany(driver, [
    job("text", ident.passport_number, ["passportNumberTextBox"]),
    job("text", ident.passport_number, ["confirmPassportNumberTextBox"]),
    job("text", ident.passport_expiry, ["passportExpiryDateDatePicker_DatePicker"]),
    job("select", ident.id_type, ["otherIdentificationDropdownlist"]),
    job("text", ident.id_issue_date, ["otherIssueDateDatePicker_DatePicker"]),
    job("text", ident.id_expiry_date, ["otherExpiryDateDatePicker_DatePicker"]),
  ]);
  log().ok("FILL_IDENTIFICATION", "Passport + National ID", nowSec() - started);
}

export async function fillHealth(driver: WebDriver): Promise<void> {
  await waiter(driver).until(until.elementLocated(By.css("select[id$='renalDialysisDropDownList']")));
  const health = applicant().health;
  const started = nowSec();
  await fillMany(driver, [
    job("select", String(health.renal_dialysis), ["renalDialysisDropDownList"]),
    job("select", String(health.active_tb), ["tuberculosisDropDownList"]),
    job("select", String(health.cancer), ["cancerDropDownList"]),
    job("select", String(health.heart_disease), ["heartDiseaseDropDownList"]),
    job("select", String(health.disability), ["disabilityDropDownList"]),
    job("select", String(health.hospitalisation), ["hospitalisationDropDownList"]),
    job("select", String(health.residential_care), ["residentailCareDropDownList", "residentialCareDropDownList"]),
    job("select", String(health.pregnancy ?? "No"), ["pregnancyStatusDropDownList"], true),
  ]);
  await setSelectMaybePostback(driver, String(health.tb_risk), "tbRiskDropDownList");
  await fillMany(driver, [job("text", health.medical_details ?? "", ["medicalConditionsTextBox"], true)]);
  log().ok("FILL_HEALTH", `TB risk=${health.tb_risk}`, nowSec() - started);
}

export async function fillCharacter(driver: WebDriver): Promise<void> {
  await waiter(driver).until(until.elementLocated(By.css("select[id$='imprisonment5YearsDropDownList']")));
  const character = applicant().character;
  const started = nowSec();
  await fillMany(driver, [
    job("select", String(character.imprisonment_5_years), ["imprisonment5YearsDropDownList"]),
    job("select", String(character.imprisonment_12_months), ["imprisonment12MonthsDropDownList"]),
    job("select", String(character.deported), ["deportedDropDownList"]),
    job("select", String(character.removal_order ?? "No"), ["removalOrderDropDownList"], true),
    job("select", String(character.charged), ["chargedDropDownList"]),
    job("select", String(character.convicted), ["convictedDropDownList"]),
    job("select", String(character.under_investigation), ["underInvestigationDropDownList"]),
    job("select", String(character.excluded), ["excludedDropDownList"]),
    job("select", String(character.removed), ["removedDropDownList"]),
    job("text", character.details ?? "", ["characterDetailsTextBox"], true),
  ]);
  log().ok("FILL_CHARACTER", "Tất cả No", nowSec() - started);
}

export async function fillWhs(driver: WebDriver): Promise<void> {
  await waiter(driver).until(
    until.elementLocated(
      By.css("select[id$='previousWhsPermitVisaDropDownList'], select[id$='sufficientFundsHolidayDropDownList']"),
    ),
  );
  const whs = { ...DEFAULT_WHS, ...(applicant().whs ?? {}) } as Record<string, string>;
  const started = nowSec();
  await fillMany(driver, [
    job("select", whs.previous_whs_visa ?? DEFAULT_WHS.previous_whs_visa, ["previousWhsPermitVisaDropDownList"]),
    job("select", whs.sufficient_funds_holiday ?? DEFAULT_WHS.sufficient_funds_holiday, [
      "sufficientFundsHolidayDropDownList",
    ]),
    job("text", whs.travel_date ?? DEFAULT_WHS.travel_date, ["intendedTravelDateDatePicker_DatePicker"]),
  ]);
  await setSelectMaybePostback(driver, whs.been_to_nz ?? DEFAULT_WHS.been_to_nz, "beenToNzDropDownList");
  await fillMany(driver, [
    job("text", whs.been_to_nz_when ?? "", ["beenToNzDateDatePicker_DatePicker", "whenInNzDatePicker_DatePicker"], true),
    job("select", whs.sufficient_funds_onward_ticket ?? DEFAULT_WHS.sufficient_funds_onward_ticket, [
      "sufficientFundsOnwardTicketDropDownList",
    ]),
    job("select", whs.meet_scheme_requirements ?? DEFAULT_WHS.meet_scheme_requirements, [
      "readRequirementsDropDownList",
    ]),
    job("select", whs.length_of_stay ?? "", ["lengthOfStayDropDownList"], true),
  ]);
  log().ok("FILL_WHS", `Travel ${whs.travel_date ?? DEFAULT_WHS.travel_date}`, nowSec() - started);
}

export async function fillPayerName(driver: WebDriver): Promise<void> {
  const name = applicant().payment?.payer_name || applicant().payer_name || "Vu Quang Nguyen";
  const started = nowSec();
  await fillMany(driver, [
    job("text", name, [
      "payerNameTextBox",
      "PayerNameTextBox",
      "payerName",
      "txtPayerName",
      "cardHolderNameTextBox",
      "nameOnCardTextBox",
      "payerFullNameTextBox",
    ], true),
  ]);
  log().ok("FILL_PAYER", name, nowSec() - started);
}
