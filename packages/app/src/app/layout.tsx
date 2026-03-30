import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/lib/providers";

const workSans = localFont({
  src: "../fonts/WorkSans-Variable.ttf",
  variable: "--font-work-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../fonts/JetBrainsMono-Variable.ttf",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#111111",
};

export const metadata: Metadata = {
  title: {
    default: "Curtn",
    template: "%s — Curtn",
  },
  description: "Discover, log, and talk about live performance. The living archive of theater, comedy, and everything on stage.",
  metadataBase: new URL("https://curtn.vercel.app"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Curtn",
    title: "Curtn",
    description: "Discover, log, and talk about live performance.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${workSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans min-h-dvh overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
