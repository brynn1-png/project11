import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "South Emerald Supermarket Inventory",
  description: "Inventory and sales operations for South Emerald Supermarket",
  icons: { icon: "/brand/south-emerald-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={figtree.variable}>{children}</body>
    </html>
  );
}
