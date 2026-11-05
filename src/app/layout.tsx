import type { Metadata } from "next";
import { APP_NAME } from "@/lib/ui-copy";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Manage products, stock, sales, returns, and daily verification for South Emerald Supermarket.",
  icons: { icon: "/brand/south-emerald-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
