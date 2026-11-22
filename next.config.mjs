import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a stray lockfile in the user home cannot confuse
  // Turbopack's workspace-root detection.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
