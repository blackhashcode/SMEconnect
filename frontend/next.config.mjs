import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// The backend API (../backend). This rewrite is for local development: on Vercel,
// the top-level rewrites in ../vercel.json send /api/* to the backend service
// before a request reaches this app, so the browser stays on one domain.
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");

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
    // Demo photos ship in public/images; uploads are served by the backend
    // through the /api/v1 rewrite below.
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/api/v1/files/public/**" }],
    // Profile photos of members who signed up with Google.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  experimental: {
    // Tree-shake icon imports so only the icons actually used are bundled.
    optimizePackageImports: ["lucide-react"],
  },
  // The browser calls /api/v1/* on this origin and Next forwards it to the
  // backend. Same origin means the session cookie is first-party: no CORS, and
  // SameSite=Lax cookies keep working.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
  // Pin the workspace root so a stray lockfile in the user home cannot confuse
  // Turbopack's workspace-root detection.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
