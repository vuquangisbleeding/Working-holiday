import { bySuffix, clickable, setText, visible } from "./dom";

type Pred = (el: HTMLInputElement) => boolean;

const NEXT_PREDS: Pred[] = [
  (el) => /nextImageButton$/i.test(el.id || ""),
  (el) => /nextButton$/i.test(el.id || ""),
  (el) => String(el.value || "").trim().toUpperCase() === "NEXT",
  (el) => String(el.textContent || "").trim().toUpperCase() === "NEXT",
  (el) => String(el.alt || el.title || "").trim().toUpperCase() === "NEXT",
];

const SAVE_PREDS: Pred[] = [
  (el) => String(el.value || "").trim().toUpperCase() === "SAVE",
  (el) => /validateButton$/i.test(el.id || "") && String(el.value || "").toUpperCase() === "SAVE",
  (el) => /save/i.test(el.id || "") && String(el.value || "").toUpperCase() === "SAVE",
  (el) => String(el.textContent || "").trim().toUpperCase() === "SAVE",
];

const SUBMIT_PREDS: Pred[] = [
  (el) => /submitImageButton$/i.test(el.id || ""),
  (el) => /submitButton$/i.test(el.id || ""),
  (el) => String(el.value || "").trim().toUpperCase() === "SUBMIT",
  (el) => String(el.textContent || "").trim().toUpperCase() === "SUBMIT",
];

export function findButton(preds: Pred[]): Record<string, unknown> | null {
  const nodes = Array.from(document.querySelectorAll("input, button, a")) as HTMLInputElement[];
  for (const pred of preds) {
    const hit = nodes.find((el) => clickable(el) && pred(el));
    if (hit) return { ok: true, id: hit.id, value: hit.value, tag: hit.tagName };
  }
  return null;
}

export function clickBy(preds: Pred[]): Record<string, unknown> {
  const nodes = Array.from(document.querySelectorAll("input, button, a")) as HTMLInputElement[];
  for (const pred of preds) {
    const matches = nodes.filter((el) => clickable(el) && pred(el));
    const el = matches[matches.length - 1];
    if (el) {
      el.click();
      return { ok: true, id: el.id, value: el.value };
    }
  }
  return { ok: false };
}

export function clickNext(): Record<string, unknown> {
  const next = clickBy(NEXT_PREDS);
  if (next.ok) return { ...next, clicked: "NEXT" };
  return { ok: false, reason: "no-next" };
}

export function hasNext(): boolean {
  return findButton(NEXT_PREDS) !== null;
}

export function clickSave(): Record<string, unknown> {
  const save = clickBy(SAVE_PREDS);
  if (save.ok) return { ...save, clicked: "SAVE" };
  return { ok: false, reason: "no-save" };
}

export function hasSubmit(): boolean {
  return findButton(SUBMIT_PREDS) !== null;
}

export function clickSubmit(): Record<string, unknown> {
  const sub = clickBy(SUBMIT_PREDS);
  if (sub.ok) return { ...sub, clicked: "SUBMIT" };
  return { ok: false, reason: "no-submit" };
}

function normLabel(el: HTMLInputElement): string {
  return [el.value, el.textContent, el.id, el.title, el.getAttribute("alt")]
    .map((s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase())
    .join(" ");
}

export function clickPayNow(): Record<string, unknown> {
  const hit = clickBy([
    (el) => {
      const blob = normLabel(el);
      return blob.includes("PAY NOW") && !blob.includes("PAY LATER");
    },
  ]);
  if (hit.ok) return { ...hit, clicked: "PAY_NOW" };
  return { ok: false, reason: "no-pay-now" };
}

function paymentGatewayLink(): HTMLAnchorElement | null {
  return (
    (document.getElementById("ContentPlaceHolder1_onlinePaymentAnchor2") as HTMLAnchorElement | null) ||
    document.querySelector("a[id$='onlinePaymentAnchor2']") ||
    document.querySelector("a[href*='PaymentGateway/OnLinePayment']") ||
    document.querySelector("a[href*='OnLinePayment.aspx']")
  );
}

export function clickNextStep(): Record<string, unknown> {
  const el = paymentGatewayLink();
  if (el) {
    const href = el.getAttribute("href") || "";
    try {
      el.click();
    } catch {
      const inner = el.querySelector(".super-link, .super-link-large, span") as HTMLElement | null;
      if (inner) inner.click();
      else if (href) location.assign(href);
    }
    return { ok: true, id: el.id, href, clicked: "NEXT_STEP" };
  }
  const byText = clickBy([
    (node) => normLabel(node).includes("SECURE PAYMENT"),
    (node) => /onlinePaymentAnchor/i.test(node.id || ""),
  ]);
  if (byText.ok) return { ...byText, clicked: "NEXT_STEP" };
  return { ok: false, reason: "no-payment-link" };
}

export function fillPayerName(value: string): Record<string, unknown> {
  let el = bySuffix(
    [
      "payerNameTextBox",
      "PayerNameTextBox",
      "payerName",
      "txtPayerName",
      "cardHolderNameTextBox",
      "nameOnCardTextBox",
      "payerFullNameTextBox",
    ],
    "input",
  );
  if (!el) {
    const lab = Array.from(document.querySelectorAll("label")).find((l) => /payer\s*name/i.test(l.textContent || ""));
    if (lab && lab.htmlFor) el = document.getElementById(lab.htmlFor);
  }
  if (!el) {
    el = Array.from(document.querySelectorAll("input[type='text'], input:not([type])")).find((i) => {
      const blob = ((i.id || "") + (i as HTMLInputElement).name + ((i as HTMLInputElement).placeholder || "")).toLowerCase();
      return visible(i) && /payer|cardholder|card.?holder/.test(blob);
    }) as HTMLElement | undefined;
  }
  return setText(el ?? null, value);
}

export function clickCountry(name: string): Record<string, unknown> {
  const spans = Array.from(document.querySelectorAll("[id^='ContentPlaceHolder1_countryRepeater_countryName_']"));
  const span = spans.find((s) => s.textContent?.trim() === name);
  if (!span) return { ok: false };
  const footer = span.closest(".category-item-footer") || span.parentElement;
  if (footer) (footer as HTMLElement).click();
  else (span as HTMLElement).click();
  return { ok: true };
}
