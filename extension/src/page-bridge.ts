import { clickAfterCaptcha, clickBy, clickCountry, clickNext, clickNextStep, clickPayNow, clickSave, clickSubmit, fillPayerName, findButton, hasNext, hasSubmit } from "./bridge/clicks";
import { bySuffix, fillMany, inPostback, setSelect } from "./bridge/dom";

declare global {
  interface Window {
    __whsBridge?: boolean;
    jQuery?: JQueryStatic;
    Sys?: { WebForms?: { PageRequestManager?: { getInstance: () => { get_isInAsyncPostBack: () => boolean } } } };
  }
}

interface JQueryStatic {
  (el: Element): {
    val: (v?: string) => { trigger: (e: string) => void; data: (k: string) => unknown; select2?: (a: string, b: string) => void };
    prop: (k: string, v: boolean) => { trigger: (e: string) => { trigger: (e: string) => void } };
    data: (k: string) => unknown;
    select2?: (a: string, b: string) => void;
    trigger: (e: string) => void;
  };
}

function tickDeclaration(): Record<string, unknown> {
  const suffixes = [
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
  ];
  const tick = (el: HTMLInputElement) => {
    if (!el || el.type !== "checkbox" || el.disabled) return false;
    if (el.checked) return true;
    try {
      el.click();
    } catch {
      // ignore
    }
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (!el.checked && el.id) {
      const label = document.querySelector('label[for="' + el.id + '"]');
      if (label) (label as HTMLElement).click();
      el.checked = true;
    }
    return !!el.checked;
  };
  const seen = new Set<HTMLInputElement>();
  const boxes: HTMLInputElement[] = [];
  const add = (el: Element | null) => {
    if (!el || seen.has(el as HTMLInputElement)) return;
    seen.add(el as HTMLInputElement);
    boxes.push(el as HTMLInputElement);
  };
  suffixes.forEach((s) => document.querySelectorAll('input[type="checkbox"][id$="' + s + '"]').forEach(add));
  let checked = 0;
  for (const el of boxes) {
    if (!el.disabled && tick(el)) checked += 1;
  }
  return { total: boxes.length, checked };
}

function handle(op: string, payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (op === "ping") return { ok: true };
  if (op === "fillMany") return { ok: true, items: fillMany((Array.isArray(payload) ? payload : []) as Parameters<typeof fillMany>[0]) };
  if (op === "setSelect") return setSelect(bySuffix((payload?.suffixes as string[]) || [], "select"), String(payload?.value ?? ""));
  if (op === "inPostback") return { yes: inPostback() };
  if (op === "tickDeclaration") return tickDeclaration();
  if (op === "clickSave") return clickSave();
  if (op === "clickNext") return clickNext();
  if (op === "hasNext") return { ok: hasNext() };
  if (op === "hasSubmit") return { ok: hasSubmit() };
  if (op === "clickSubmit") return clickSubmit();
  if (op === "clickAfterCaptcha") return clickAfterCaptcha(!!payload?.preferSubmit);
  if (op === "clickPayLater") {
    return clickBy([
      (el) => String(el.value || "").replace(/\s+/g, " ").trim().toUpperCase() === "PAY LATER",
      (el) => String(el.textContent || "").replace(/\s+/g, " ").trim().toUpperCase().includes("PAY LATER"),
      (el) => /paylater/i.test(el.id || ""),
    ]);
  }
  if (op === "clickPayNow") return clickPayNow();
  if (op === "clickNextStep") return clickNextStep();
  if (op === "fillPayerName") return fillPayerName(payload?.value != null ? String(payload.value) : "");
  if (op === "clickOk") {
    return clickBy([
      (el) => String(el.value || "").trim().toUpperCase() === "OK",
      (el) => String(el.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "OK",
      (el) => /okButton$/i.test(el.id || ""),
    ]);
  }
  if (op === "clickLogin") {
    return clickBy([(el) => String(el.value || "").toUpperCase() === "LOGIN" && el.type === "submit"]);
  }
  if (op === "clickApplyNow") {
    const el = document.getElementById("ContentPlaceHolder1_applyNowButton");
    if (el) {
      el.click();
      return { ok: true };
    }
    return clickBy([(e) => String(e.value || "").toUpperCase() === "APPLY NOW"]);
  }
  if (op === "clickEdit") {
    const el = document.querySelector("a[id^='ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_']");
    if (el) {
      (el as HTMLElement).click();
      return { ok: true };
    }
    return { ok: false };
  }
  if (op === "clickCountry") return clickCountry(String(payload?.country ?? ""));
  if (op === "findPayLater") {
    return (
      findButton([
        (el) => String(el.value || "").replace(/\s+/g, " ").trim().toUpperCase() === "PAY LATER",
        (el) => String(el.textContent || "").toUpperCase().includes("PAY LATER"),
      ]) || { ok: false }
    );
  }
  return { error: "unknown op " + op };
}

if (!window.__whsBridge) {
  window.__whsBridge = true;
  document.addEventListener("whs-bridge", (e) => {
    const { id, op, payload } = (e as CustomEvent).detail || {};
    let result: Record<string, unknown>;
    try {
      result = handle(op, payload);
    } catch (err) {
      result = { error: String(err) };
    }
    document.dispatchEvent(new CustomEvent("whs-bridge-result", { detail: { id, result } }));
  });
}
