import { config } from "dotenv";
import fs from "fs";
import path from "path";
import type { Applicant } from "../types.ts";
import { ROOT } from "./constants.ts";

let DATA: Applicant | null = null;

export function setApplicant(data: Applicant): void {
  DATA = data;
}

export function applicant(): Applicant {
  if (!DATA) throw new Error("Applicant data not initialized");
  return DATA;
}

export function loadCredentials(): [string, string] {
  config({ path: path.join(ROOT, ".env") });
  const username = (process.env.INZ_USERNAME ?? "").trim();
  const password = (process.env.INZ_PASSWORD ?? "").trim();
  if (!username || !password) {
    console.error("Missing INZ_USERNAME or INZ_PASSWORD in .env");
    process.exit(1);
  }
  return [username, password];
}

export function loadApplicant(): Applicant {
  const filePath = path.join(ROOT, "applicant.json");
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${filePath}. Create it to manage form values.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Applicant;
}
