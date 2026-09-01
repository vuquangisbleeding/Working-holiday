import type { Applicant } from "../types.ts";

export function applicantIdentityLines(data?: Applicant | null): string[] {
  const p = data?.personal;
  const name = [p?.family_name, p?.given_name_1, p?.given_name_2, p?.given_name_3]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  const email = String(data?.contact?.email || "").trim();
  return [name ? "Họ tên: " + name : "", email ? "Email: " + email : ""].filter(Boolean);
}
