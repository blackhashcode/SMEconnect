import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted at build time: no render-blocking request to Google Fonts and no layout shift.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: "SME Connect — Verified business network",
    template: "%s · SME Connect",
  },
  description:
    "Connect verified Bangladeshi small businesses with investors. Make direct loan offers, negotiate terms and track repayments.",
  icons: { icon: "/images/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f8f9ff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
