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

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins(),
};

export default nextConfig;
