export function t(key: string, values: Record<string, string | number> = {}) {
  let message =
    chrome.i18n.getMessage(key) || chrome.i18n.getMessage('unexpected') || key
  for (const [name, value] of Object.entries(values))
    message = message.replace('{' + name + '}', String(value))
  return message
}
