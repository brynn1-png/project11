import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { APP_NAME } from "@/lib/ui-copy";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Manage products, stock, sales, returns, and daily verification for South Emerald Supermarket.",
  icons: { icon: "/brand/south-emerald-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={figtree.variable}>{children}</body>
    </html>
  );
}
