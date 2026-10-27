/** Keep certificate verification explicit across pg major-version changes. */
export function postgresRuntimeUrl(input: string): string {
  const url = new URL(input);
  if (
    url.hostname.endsWith(".neon.tech") &&
    url.searchParams.get("sslmode") === "require"
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

export function isLocalDemoDatabase(input: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(input).hostname);
}
