import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citeflora · Trace traditional knowledge to its source",
  description: "Review medicinal plant reports with source passages, explicit uncertainty, taxonomy checks, and attributed evidence exports.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
