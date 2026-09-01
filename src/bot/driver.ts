import { Builder, type WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { WAIT_POLL, WAIT_SECONDS } from "./constants.ts";

export type WaitCondition<T> = (driver: WebDriver) => T | Promise<T>;

export interface Waiter {
  until<T>(condition: WaitCondition<T> | unknown): Promise<T>;
}

export function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.setPageLoadStrategy("eager");
  options.addArguments("--start-maximized");
  options.addArguments("--disable-blink-features=AutomationControlled");
  options.excludeSwitches("enable-automation");
  const chromeKey = "goog:chromeOptions";
  const existing = (options.get(chromeKey) as Record<string, unknown> | undefined) ?? {};
  options.set(chromeKey, { ...existing, useAutomationExtension: false, detach: true });
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

export function waiter(driver: WebDriver, timeoutMs = WAIT_SECONDS): Waiter {
  return {
    until<T>(condition: WaitCondition<T> | unknown): Promise<T> {
      return driver.wait(condition as never, timeoutMs, undefined, WAIT_POLL) as unknown as Promise<T>;
    },
  };
}

export async function waitReady(driver: WebDriver, wait: Waiter | null = null): Promise<void> {
  const w = wait ?? waiter(driver);
  await w.until(async (d: WebDriver) => {
    const state = await d.executeScript("return document.readyState");
    return state === "interactive" || state === "complete";
  });
}
