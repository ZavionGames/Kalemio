// Shared by content and background. Storage holds exact hostnames.
export function supported(url: string, blocked: string[] = []) {
  try {
    const u = new URL(url)
    return (
      /^https?:$/.test(u.protocol) &&
      !blocked.includes(u.hostname) &&
      !(
        u.hostname === 'docs.google.com' && u.pathname.startsWith('/document/')
      ) &&
      !/(?:bank|banka|paytr|iyzico|paypal|stripe|checkout|ödeme|odeme|payment|klarna|adyen|garanti|yapikredi|akbank|ziraat|ing\.com|kuveytturk|turkiyefinans|qnb|denizbank|vakifkatilim)/i.test(
        u.hostname + u.pathname
      )
    )
  } catch {
    return false
  }
}
