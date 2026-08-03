const shortPaymentPagePath = /^\/(?:l|rzp)\/[A-Za-z0-9_-]+$/;
const longPaymentPagePath = /^\/pl_[A-Za-z0-9]+\/view$/;

export function parseSupportUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      !isRazorpayPaymentPage(url)
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isRazorpayPaymentPage(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "rzp.io") {
    return shortPaymentPagePath.test(url.pathname);
  }
  if (hostname === "pages.razorpay.com") {
    return longPaymentPagePath.test(url.pathname);
  }
  return false;
}

export function getSupportUrl(): string | null {
  return parseSupportUrl(process.env.SUPPORT_URL);
}
