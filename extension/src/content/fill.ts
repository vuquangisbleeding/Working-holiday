import type { Applicant } from "../../../src/types";
import { callBridge, job, waitPostback } from "./bridge";
import { addLog } from "./log";
import { setActivity, setStatus } from "./state";

type FillJob = { kind: string; value: string; suffixes: string[]; optional?: boolean };

function fieldName(job: FillJob): string {
  return job.suffixes[0] || "?";
}

function logResult(job: FillJob, result: Record<string, unknown> | undefined): void {
  const name = fieldName(job);
  const value = job.value === "" ? "(trống)" : job.value;
  if (job.optional && job.value === "") {
    addLog("FILL", name + " (bỏ qua, không bắt buộc)");
    return;
  }
  if (!result || result.skipped) {
    addLog("FILL", name + " = " + value + " (không thấy ô)");
    return;
  }
  if (result.unchanged) {
    addLog("FILL", name + " = " + value + " (đã đúng)");
    return;
  }
  addLog("FILL", name + " = " + value);
}

async function fillJobs(jobs: FillJob[]): Promise<void> {
  const r = await callBridge("fillMany", jobs);
  const items = (Array.isArray(r.items) ? r.items : Array.isArray(r) ? r : []) as Record<string, unknown>[];
  jobs.forEach((j, i) => logResult(j, items[i]));
}

async function setSelectLogged(suffixes: string[], value: string): Promise<boolean> {
  const name = suffixes[0] || "select";
  setActivity("", "điền " + name + " = " + value);
  const r = await callBridge("setSelect", { suffixes, value });
  logResult({ kind: "select", value, suffixes }, r);
  return !r.unchanged && !!r.ok;
}

export async function fillPage(page: string, data: Applicant): Promise<string> {
  const p = data.personal || {};
  const a = data.address || {};
  const c = data.contact || {};
  const id = data.identification || {};
  const h = data.health || {};
  const ch = data.character || {};
  const w = Object.assign(
    {
      previous_whs_visa: "No",
      sufficient_funds_holiday: "Yes",
      travel_date: "20 November, 2026",
      been_to_nz: "No",
      sufficient_funds_onward_ticket: "Yes",
      meet_scheme_requirements: "Yes",
    },
    data.whs || {},
  );

  if (page === "personal1") {
    if (await setSelectLogged(["representedByAgentDropdownlist"], c.has_agent || "No")) await waitPostback();
    await fillJobs([
      job("text", p.family_name, "familyNameTextBox"),
      job("text", p.given_name_1, ["givenName1Textbox", "givenName1TextBox"]),
      job("text", p.given_name_2, ["givenName2Textbox", "givenName2TextBox"], true),
      job("text", p.given_name_3, ["givenName3Textbox", "givenName3TextBox"], true),
      job("text", p.other_names, "otherNamesTextBox", true),
      job("select", p.title, "titleDropDownList"),
      job("text", p.other_title, "otherTitleTextBox", true),
      job("select", p.gender, "genderDropDownList"),
      job("text", p.date_of_birth, "dateOfBirthDatePicker_DatePicker"),
      job("select", p.country_of_birth, "personDetails_CountryDropDownList"),
      job("text", a.street_number, ["streetNumberTextbox", "streetNumberTextBox"]),
      job("text", a.street_name, "address1TextBox"),
      job("text", a.suburb, "suburbTextBox"),
      job("text", a.city, "cityTextBox"),
      job("text", a.province, "provinceStateTextBox"),
      job("text", a.postal_code, "postalCodeTextBox"),
      job("select", a.country, "address_countryDropDownList"),
      job("text", c.phone_daytime, "phoneNumberTextBox", true),
      job("text", c.phone_night, "phoneNumberNightTextBox", true),
      job("text", c.phone_mobile, "phoneNumberMobileTextBox"),
      job("text", c.fax, ["faxNumberTextbox", "faxNumberTextBox"], true),
      job("text", c.email, "emailAddressTextBox"),
      job("select", c.communication_method, "communicationMethodDropDownList"),
      job("select", c.has_credit_card, "hasCreditCardDropDownlist"),
    ]);
    return "continue";
  }
  if (page === "personal2") {
    await fillJobs([
      job("text", id.passport_number, "passportNumberTextBox"),
      job("text", id.passport_number, "confirmPassportNumberTextBox"),
      job("text", id.passport_expiry, "passportExpiryDateDatePicker_DatePicker"),
      job("select", id.id_type, "otherIdentificationDropdownlist"),
      job("text", id.id_issue_date, "otherIssueDateDatePicker_DatePicker"),
      job("text", id.id_expiry_date, "otherExpiryDateDatePicker_DatePicker"),
    ]);
    return "continue";
  }
  if (page === "health") {
    await fillJobs([
      job("select", h.renal_dialysis, "renalDialysisDropDownList"),
      job("select", h.active_tb, "tuberculosisDropDownList"),
      job("select", h.cancer, "cancerDropDownList"),
      job("select", h.heart_disease, "heartDiseaseDropDownList"),
      job("select", h.disability, "disabilityDropDownList"),
      job("select", h.hospitalisation, "hospitalisationDropDownList"),
      job("select", h.residential_care, ["residentailCareDropDownList", "residentialCareDropDownList"]),
      job("select", h.pregnancy || "No", "pregnancyStatusDropDownList", true),
    ]);
    if (await setSelectLogged(["tbRiskDropDownList"], h.tb_risk || "Yes")) await waitPostback();
    await fillJobs([job("text", h.medical_details, "medicalConditionsTextBox", true)]);
    return "continue";
  }
  if (page === "character") {
    await fillJobs([
      job("select", ch.imprisonment_5_years, "imprisonment5YearsDropDownList"),
      job("select", ch.imprisonment_12_months, "imprisonment12MonthsDropDownList"),
      job("select", ch.deported, "deportedDropDownList"),
      job("select", ch.removal_order || "No", "removalOrderDropDownList", true),
      job("select", ch.charged, "chargedDropDownList"),
      job("select", ch.convicted, "convictedDropDownList"),
      job("select", ch.under_investigation, "underInvestigationDropDownList"),
      job("select", ch.excluded, "excludedDropDownList"),
      job("select", ch.removed, "removedDropDownList"),
      job("text", ch.details, "characterDetailsTextBox", true),
    ]);
    return "continue";
  }
  if (page === "whs") {
    await fillJobs([
      job("select", w.previous_whs_visa, "previousWhsPermitVisaDropDownList"),
      job("select", w.sufficient_funds_holiday, "sufficientFundsHolidayDropDownList"),
      job("text", w.travel_date, "intendedTravelDateDatePicker_DatePicker"),
    ]);
    if (await setSelectLogged(["beenToNzDropDownList"], w.been_to_nz)) await waitPostback();
    await fillJobs([
      job("text", w.been_to_nz_when, ["beenToNzDateDatePicker_DatePicker", "whenInNzDatePicker_DatePicker"], true),
      job("select", w.sufficient_funds_onward_ticket, "sufficientFundsOnwardTicketDropDownList"),
      job("select", w.meet_scheme_requirements, "readRequirementsDropDownList"),
      job("select", w.length_of_stay || "", "lengthOfStayDropDownList", true),
    ]);
    return "continue";
  }
  if (page === "personal3") return "continue";
  if (page === "declaration") {
    const r = await callBridge("tickDeclaration");
    setStatus("Đã tick " + (r.checked || 0) + "/" + (r.total || 0) + " ô Yes");
    return "submit";
  }
  if (page === "pay_now") return "pay_now";
  if (page === "pay_next") return "pay_next";
  if (page === "payer") {
    const name = data.payment?.payer_name || data.payer_name || "Vu Quang Nguyen";
    const r = await callBridge("fillPayerName", { value: name });
    addLog("FILL", "Payer name: " + name + (r && r.ok ? "" : " (không thấy ô)"));
    return "payer_ok";
  }
  if (page === "pay_card") return "done_pay";
  if (page === "pay") return "pay_now";
  if (page === "payment") return "pay_next";
  return "unknown";
}
