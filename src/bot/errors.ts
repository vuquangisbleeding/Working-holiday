export function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || /timeout/i.test(err.name);
}

export function isWebdriverError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (isTimeoutError(err)) return true;
  const { name, message } = err;
  return (
    name === "WebDriverError" ||
    name.includes("WebDriver") ||
    /StaleElement|NoSuchElement|NoSuchWindow|InvalidSession|ScriptTimeout|UnexpectedAlert|ElementClickIntercepted|ElementNotInteractable/i.test(
      name,
    ) ||
    /stale element|no such element|webdriver|not interactable|click intercepted/i.test(message)
  );
}
