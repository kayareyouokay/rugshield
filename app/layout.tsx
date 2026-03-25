import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RugShield",
    template: "%s | RugShield",
  },
  description: "Production-style Ethereum token risk screening with liquidity, holder, contract, and honeypot diagnostics.",
  applicationName: "RugShield",
  keywords: ["ethereum", "erc-20", "token risk", "honeypot", "liquidity", "holder analysis"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
