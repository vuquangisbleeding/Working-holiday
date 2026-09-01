import type { WebDriver } from "selenium-webdriver";
import { clickNext, clickNextStep, clickOk, clickPayNow, clickSubmit } from "./clicks.ts";
import { MAX_WIZARD_PAGES } from "./constants.ts";
import { fillDeclaration } from "./declaration.ts";
import { dumpUnknownFields } from "./elements.ts";
import { resumeSession } from "./entry.ts";
import { fillCharacter, fillHealth, fillIdentification, fillPayerName, fillPersonal1, fillWhs } from "./forms.ts";
import { log } from "./logger.ts";
import { detectPage } from "./page.ts";
import { recoverHighLoad } from "./recover.ts";

async function fillCurrentPage(driver: WebDriver, page: string): Promise<string> {
  if (page === "personal1") {
    await fillPersonal1(driver);
    return "continue";
  }
  if (page === "personal2") {
    await fillIdentification(driver);
    return "continue";
  }
  if (page === "health") {
    await fillHealth(driver);
    return "continue";
  }
  if (page === "character") {
    await fillCharacter(driver);
    return "continue";
  }
  if (page === "whs") {
    await fillWhs(driver);
    return "continue";
  }
  if (page === "personal3") {
    await dumpUnknownFields(driver, page);
    log().info("PERSONAL3", "Không có mapping field — bấm Next");
    return "continue";
  }
  if (page === "declaration") {
    await fillDeclaration(driver);
    return "submit";
  }
  if (page === "pay_now" || page === "pay") return "pay_now";
  if (page === "pay_next") return "pay_next";
  if (page === "payer") {
    await fillPayerName(driver);
    return "payer_ok";
  }
  if (page === "payment") {
    log().ok("STOP", "Tới trang thanh toán thẻ. Không điền thẻ.");
    return "stop";
  }
  await dumpUnknownFields(driver, page);
  log().info("STOP", "Trang này chưa có mapping field. Gửi screenshot hoặc bổ sung applicant.json rồi chạy lại.");
  return "stop";
}

export async function walkWizard(driver: WebDriver): Promise<void> {
  const visits = new Map<string, number>();
  for (let index = 0; index < MAX_WIZARD_PAGES; index += 1) {
    let recovered = await recoverHighLoad(driver);
    const page = await detectPage(driver);
    const url = await driver.getCurrentUrl();
    log().info("PAGE", `${index + 1}. ${page} | ${url}`);
    if (page === "highload") continue;
    if (page === "login") {
      await resumeSession(driver);
      recovered = true;
      continue;
    }
    const seen = visits.get(url) ?? 0;
    if (seen >= 2 && !recovered) {
      log().info("STOP", "URL lặp lại, dừng để tránh vòng lặp");
      return;
    }
    visits.set(url, seen + 1);

    const action = await fillCurrentPage(driver, page);
    if (action === "stop") return;
    if (action === "submit") {
      await clickSubmit(driver);
      continue;
    }
    if (action === "pay_now") {
      await clickPayNow(driver);
      continue;
    }
    if (action === "pay_next") {
      await clickNextStep(driver);
      continue;
    }
    if (action === "payer_ok") {
      await clickOk(driver);
      continue;
    }
    await clickNext(driver);
  }
  log().info("STOP", `Đã đi hết ${MAX_WIZARD_PAGES} trang wizard`);
}
