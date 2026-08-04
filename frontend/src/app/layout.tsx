import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";

// Geist — a modern variable grotesque, self-hosted (no network at build time).
// One file covers the full 100–900 weight range, so headings and UI share one
// coherent face instead of the dated OS default the app used to fall back to.
const geist = localFont({
  src: "../fonts/Geist.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "LearnSmart AI — Skills Intelligence System",
  description:
    "AI-powered learning and skills intelligence platform for iMET / Imperial Edutech.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
