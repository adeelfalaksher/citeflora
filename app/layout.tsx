import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citeflora · Plant knowledge with a paper trail",
  metadataBase: new URL("https://citeflora.vercel.app"),
  openGraph: {title: "Citeflora · Plant knowledge with a paper trail", description: "Turn published plant use reports into records you can check. Inspect the passage, save a review, and export the evidence.", url: "https://citeflora.vercel.app", type: "website", images: [{url: "/media/citeflora-cover.png", width:1536, height:1024, alt:"Citeflora research evidence workspace"}]},
  twitter: {card:"summary_large_image", title:"Citeflora", description:"Plant knowledge with a paper trail.", images:["/media/citeflora-cover.png"]},
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
