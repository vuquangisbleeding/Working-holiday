export type El = HTMLInputElement & HTMLSelectElement & HTMLAnchorElement & HTMLButtonElement;

export function bySuffix(suffixes: string[], tag = ""): HTMLElement | null {
  for (const s of suffixes) {
    const el = document.querySelector((tag || "") + '[id$="' + s + '"]');
    if (el) return el as HTMLElement;
  }
  return null;
}

export function visible(el: Element | null): boolean {
  if (!el) return false;
  const st = window.getComputedStyle(el);
  return st.display !== "none" && st.visibility !== "hidden" && (el as HTMLElement).offsetWidth + (el as HTMLElement).offsetHeight > 0;
}

export function clickable(el: Element | null): boolean {
  if (!visible(el)) return false;
  const html = el as HTMLInputElement;
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

export function setText(el: HTMLElement | null, value: string): Record<string, unknown> {
  if (!el) return { ok: false };
  const input = el as HTMLInputElement;
  if (String(input.value || "") === String(value || "")) return { ok: true, unchanged: true };
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  if (window.jQuery) window.jQuery(input).val(value).trigger("change");
  return { ok: true };
}

export function setSelect(el: HTMLElement | null, wanted: string): Record<string, unknown> {
  if (!el) return { ok: false };
  const select = el as HTMLSelectElement;
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

export function fillMany(jobs: Array<{ optional?: boolean; value?: string; suffixes: string[]; kind: string }>): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
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

export function inPostback(): boolean {
  try {
    return !!(
      window.Sys &&
      window.Sys.WebForms &&
      window.Sys.WebForms.PageRequestManager &&
      window.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()
    );
  } catch {
    return false;
  }
}
