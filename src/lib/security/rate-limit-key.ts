export function readClientAddress(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, 64);
}

export function buildLoginRateLimitIdentifier(email: string, address: string) {
  return `${email.trim().toLocaleLowerCase()}|${address.trim().toLocaleLowerCase()}`.slice(0, 320);
}
