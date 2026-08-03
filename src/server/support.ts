const supportedHosts = new Set([
  "buymeacoffee.com",
  "www.buymeacoffee.com",
  "ko-fi.com",
  "www.ko-fi.com",
]);

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
      !supportedHosts.has(url.hostname.toLowerCase()) ||
      url.pathname === "/"
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function getSupportUrl(): string | null {
  return parseSupportUrl(process.env.SUPPORT_URL);
}
