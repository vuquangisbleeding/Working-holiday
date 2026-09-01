"use strict";
(() => {
  // extension/src/bridge/dom.ts
  function bySuffix(suffixes, tag = "") {
    for (const s of suffixes) {
      const el = document.querySelector((tag || "") + '[id$="' + s + '"]');
      if (el) return el;
    }
    return null;
  }
  function visible(el) {
    if (!el) return false;
    const st = window.getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden" && el.offsetWidth + el.offsetHeight > 0;
  }
  function clickable(el) {
    if (!visible(el)) return false;
    const html = el;
    if (html.disabled) return false;
    if (html.getAttribute("aria-disabled") === "true") return false;
    if (html.classList.contains("aspNetDisabled") || html.classList.contains("disabled")) return false;
    let parent = el.parentElement;
    while (parent) {
      const st = window.getComputedStyle(parent);
      if (st.display === "none" || st.visibility === "hidden") return false;
      parent = parent.parentElement;
    }
    return true;
  }
  function setText(el, value) {
    if (!el) return { ok: false };
    const input = el;
    if (String(input.value || "") === String(value || "")) return { ok: true, unchanged: true };
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.jQuery) window.jQuery(input).val(value).trigger("change");
    return { ok: true };
  }
  function setSelect(el, wanted) {
    if (!el) return { ok: false };
    const select = el;
    const w = String(wanted || "").trim();
    if (!w) return { ok: true, skipped: true };
    const opt = Array.from(select.options || []).find((o) => o.text.trim() === w || o.value === w);
    if (!opt) return { ok: false, options: Array.from(select.options || []).map((o) => o.text.trim()) };
    if (select.value === opt.value) return { ok: true, unchanged: true, value: opt.value };
    select.value = opt.value;
    if (window.jQuery) {
      const $el = window.jQuery(select);
      $el.val(opt.value);
      if ($el.data("select2")) $el.select2("val", opt.value);
      $el.trigger("change");
    } else {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { ok: true, unchanged: false, value: opt.value };
  }
  function fillMany(jobs) {
    const results = [];
    for (const job of jobs || []) {
      if (job.optional && (job.value === "" || job.value == null)) {
        results.push({ ok: true, skipped: true });
        continue;
      }
      const el = bySuffix(job.suffixes, job.kind === "select" ? "select" : "");
      if (!el) {
        results.push({ ok: !!job.optional, skipped: true, suffixes: job.suffixes });
        continue;
      }
      const r = job.kind === "select" ? setSelect(el, job.value || "") : setText(el, job.value || "");
      r.id = el.id;
      results.push(r);
    }
    return results;
  }
  function inPostback() {
    try {
      return !!(window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager && window.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack());
    } catch {
      return false;
    }
  }

  // extension/src/bridge/clicks.ts
  var NEXT_PREDS = [
    (el) => /nextImageButton$/i.test(el.id || ""),
    (el) => /nextButton$/i.test(el.id || ""),
    (el) => String(el.value || "").trim().toUpperCase() === "NEXT",
    (el) => String(el.textContent || "").trim().toUpperCase() === "NEXT",
    (el) => String(el.alt || el.title || "").trim().toUpperCase() === "NEXT"
  ];
  var SAVE_PREDS = [
    (el) => String(el.value || "").trim().toUpperCase() === "SAVE",
    (el) => /validateButton$/i.test(el.id || "") && String(el.value || "").toUpperCase() === "SAVE",
    (el) => /save/i.test(el.id || "") && String(el.value || "").toUpperCase() === "SAVE",
    (el) => String(el.textContent || "").trim().toUpperCase() === "SAVE"
  ];
  var SUBMIT_PREDS = [
    (el) => /submitImageButton$/i.test(el.id || ""),
    (el) => /submitButton$/i.test(el.id || ""),
    (el) => String(el.value || "").trim().toUpperCase() === "SUBMIT",
    (el) => String(el.textContent || "").trim().toUpperCase() === "SUBMIT"
  ];
  var CONTINUE_PREDS = [
    (el) => /continueButton$/i.test(el.id || ""),
    (el) => /continueImageButton$/i.test(el.id || ""),
    (el) => String(el.value || "").trim().toUpperCase() === "CONTINUE",
    (el) => String(el.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "CONTINUE",
    (el) => String(el.alt || el.title || "").trim().toUpperCase() === "CONTINUE"
  ];
  function findButton(preds) {
    const nodes = Array.from(document.querySelectorAll("input, button, a"));
    for (const pred of preds) {
      const hit = nodes.find((el) => clickable(el) && pred(el));
      if (hit) return { ok: true, id: hit.id, value: hit.value, tag: hit.tagName };
    }
    return null;
  }
  function clickBy(preds) {
    const nodes = Array.from(document.querySelectorAll("input, button, a"));
    for (const pred of preds) {
      const matches = nodes.filter((el2) => clickable(el2) && pred(el2));
      const el = matches[matches.length - 1];
      if (el) {
        el.click();
        return { ok: true, id: el.id, value: el.value };
      }
    }
    return { ok: false };
  }
  function clickNext() {
    const next = clickBy(NEXT_PREDS);
    if (next.ok) return { ...next, clicked: "NEXT" };
    return { ok: false, reason: "no-next" };
  }
  function hasNext() {
    return findButton(NEXT_PREDS) !== null;
  }
  function clickSave() {
    const save = clickBy(SAVE_PREDS);
    if (save.ok) return { ...save, clicked: "SAVE" };
    return { ok: false, reason: "no-save" };
  }
  function hasSubmit() {
    return findButton(SUBMIT_PREDS) !== null;
  }
  function clickSubmit() {
    if (document.documentElement.dataset.whsSubmitted === "1") {
      return { ok: false, reason: "already-submitted" };
    }
    const sub = clickBy(SUBMIT_PREDS);
    if (sub.ok) document.documentElement.dataset.whsSubmitted = "1";
    if (sub.ok) return { ...sub, clicked: "SUBMIT" };
    return { ok: false, reason: "no-submit" };
  }
  function clickAfterCaptcha(preferSubmit = false) {
    if (preferSubmit) return clickSubmit();
    const groups = [
      { preds: CONTINUE_PREDS, clicked: "CONTINUE" },
      { preds: NEXT_PREDS, clicked: "NEXT" }
    ];
    for (const group of groups) {
      const hit = clickBy(group.preds);
      if (hit.ok) return { ...hit, clicked: group.clicked };
    }
    return { ok: false, reason: "no-advance" };
  }
  function normLabel(el) {
    return [el.value, el.textContent, el.id, el.title, el.getAttribute("alt")].map((s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase()).join(" ");
  }
  function clickPayNow() {
    const hit = clickBy([
      (el) => {
        const blob = normLabel(el);
        return blob.includes("PAY NOW") && !blob.includes("PAY LATER");
      }
    ]);
    if (hit.ok) return { ...hit, clicked: "PAY_NOW" };
    return { ok: false, reason: "no-pay-now" };
  }
  function paymentGatewayLink() {
    return document.getElementById("ContentPlaceHolder1_onlinePaymentAnchor2") || document.querySelector("a[id$='onlinePaymentAnchor2']") || document.querySelector("a[href*='PaymentGateway/OnLinePayment']") || document.querySelector("a[href*='OnLinePayment.aspx']");
  }
  function clickNextStep() {
    const el = paymentGatewayLink();
    if (el) {
      const href = el.getAttribute("href") || "";
      try {
        el.click();
      } catch {
        const inner = el.querySelector(".super-link, .super-link-large, span");
        if (inner) inner.click();
        else if (href) location.assign(href);
      }
      return { ok: true, id: el.id, href, clicked: "NEXT_STEP" };
    }
    const byText = clickBy([
      (node) => normLabel(node).includes("SECURE PAYMENT"),
      (node) => /onlinePaymentAnchor/i.test(node.id || "")
    ]);
    if (byText.ok) return { ...byText, clicked: "NEXT_STEP" };
    return { ok: false, reason: "no-payment-link" };
  }
  function fillPayerName(value) {
    let el = bySuffix(
      [
        "payerNameTextBox",
        "PayerNameTextBox",
        "payerName",
        "txtPayerName",
        "cardHolderNameTextBox",
        "nameOnCardTextBox",
        "payerFullNameTextBox"
      ],
      "input"
    );
    if (!el) {
      const lab = Array.from(document.querySelectorAll("label")).find((l) => /payer\s*name/i.test(l.textContent || ""));
      if (lab && lab.htmlFor) el = document.getElementById(lab.htmlFor);
    }
    if (!el) {
      el = Array.from(document.querySelectorAll("input[type='text'], input:not([type])")).find((i) => {
        const blob = ((i.id || "") + i.name + (i.placeholder || "")).toLowerCase();
        return visible(i) && /payer|cardholder|card.?holder/.test(blob);
      });
    }
    return setText(el ?? null, value);
  }
  function clickCountry(name) {
    const spans = Array.from(document.querySelectorAll("[id^='ContentPlaceHolder1_countryRepeater_countryName_']"));
    const span = spans.find((s) => s.textContent?.trim() === name);
    if (!span) return { ok: false };
    const footer = span.closest(".category-item-footer") || span.parentElement;
    if (footer) footer.click();
    else span.click();
    return { ok: true };
  }

  // extension/src/page-bridge.ts
  function tickDeclaration() {
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
      "medicalInsuranceCheckBox"
    ];
    const tick = (el) => {
      if (!el || el.type !== "checkbox" || el.disabled) return false;
      try {
        el.click();
      } catch {
      }
      el.checked = true;
      el.dispatchEvent(new Event("click", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (!el.checked && el.id) {
        const label = document.querySelector('label[for="' + el.id + '"]');
        if (label) label.click();
        el.checked = true;
      }
      return !!el.checked;
    };
    const seen = /* @__PURE__ */ new Set();
    const boxes = [];
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      boxes.push(el);
    };
    suffixes.forEach((s) => document.querySelectorAll('input[type="checkbox"][id$="' + s + '"]').forEach(add));
    document.querySelectorAll('input[type="checkbox"]').forEach(add);
    let checked = 0;
    for (const el of boxes) {
      if (!el.disabled && tick(el)) checked += 1;
    }
    return { total: boxes.length, checked };
  }
  function handle(op, payload) {
    if (op === "ping") return { ok: true };
    if (op === "fillMany") return { ok: true, items: fillMany(Array.isArray(payload) ? payload : []) };
    if (op === "setSelect") return setSelect(bySuffix(payload?.suffixes || [], "select"), String(payload?.value ?? ""));
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
        (el) => /paylater/i.test(el.id || "")
      ]);
    }
    if (op === "clickPayNow") return clickPayNow();
    if (op === "clickNextStep") return clickNextStep();
    if (op === "fillPayerName") return fillPayerName(payload?.value != null ? String(payload.value) : "");
    if (op === "clickOk") {
      return clickBy([
        (el) => String(el.value || "").trim().toUpperCase() === "OK",
        (el) => String(el.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "OK",
        (el) => /okButton$/i.test(el.id || "")
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
        el.click();
        return { ok: true };
      }
      return { ok: false };
    }
    if (op === "clickCountry") return clickCountry(String(payload?.country ?? ""));
    if (op === "findPayLater") {
      return findButton([
        (el) => String(el.value || "").replace(/\s+/g, " ").trim().toUpperCase() === "PAY LATER",
        (el) => String(el.textContent || "").toUpperCase().includes("PAY LATER")
      ]) || { ok: false };
    }
    return { error: "unknown op " + op };
  }
  if (!window.__whsBridge) {
    window.__whsBridge = true;
    document.addEventListener("whs-bridge", (e) => {
      const { id, op, payload } = e.detail || {};
      let result;
      try {
        result = handle(op, payload);
      } catch (err) {
        result = { error: String(err) };
      }
      document.dispatchEvent(new CustomEvent("whs-bridge-result", { detail: { id, result } }));
    });
  }
})();
