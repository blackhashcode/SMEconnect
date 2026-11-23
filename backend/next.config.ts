import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

function isPrivateIPv4(address: string): boolean {
  const [first, second] = address.split(".").map(Number);
  if (!Number.isInteger(first) || !Number.isInteger(second)) return false;

  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function toHostname(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .trim();
}

function allowedDevOrigins(): string[] {
  const hosts = new Set<string>(["localhost"]);

  for (const interfaces of Object.values(networkInterfaces())) {
    for (const details of interfaces ?? []) {
      if (details.family === "IPv4" && isPrivateIPv4(details.address)) {
        hosts.add(details.address);
      }
    }
  }

  for (const value of (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "").split(",")) {
    const hostname = toHostname(value);
    if (hostname) hosts.add(hostname);
  }

  return [...hosts];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only matters over HTTPS; browsers ignore it on plain http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins(),
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Nothing may frame the API, except stored documents, which the admin
      // panel shows in a same-origin viewer (that route sets SAMEORIGIN itself).
      { source: "/((?!api/v1/files/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
