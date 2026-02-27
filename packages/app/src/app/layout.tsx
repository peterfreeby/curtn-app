import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const neueRegrade = localFont({
  src: "../fonts/NeueRegrade-Variable.ttf",
  variable: "--font-neue-regrade",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Curtn",
  description: "The stage is yours.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={neueRegrade.variable}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
