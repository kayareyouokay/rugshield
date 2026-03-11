import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RugShield",
  description: "Web3 token risk analyzer",
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
