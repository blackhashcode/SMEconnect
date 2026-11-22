import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  images: {
    // Serve modern formats; Next resizes each image to the size it's displayed at.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // Tree-shake icon imports so only the icons actually used are bundled.
    optimizePackageImports: ["lucide-react"],
  },
  // The browser calls /api/* on this origin; Next forwards it to the Express API
  // in mock-api/. Same origin means the session cookie just works, no CORS needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  // Pin the workspace root so a stray lockfile in the user home cannot confuse
  // Turbopack's workspace-root detection.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
