import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExposureGuard AI",
  description:
    "Understand your digital exposure before someone else uses it against you.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ExposureGuard AI",
    description:
      "Breach intelligence and doxxing defence, explained in plain language.",
    type: "website",
    images: [
      {
        url: "/exposureguard-social.png",
        width: 1760,
        height: 925,
        alt: "ExposureGuard AI — See what the internet knows about you.",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
