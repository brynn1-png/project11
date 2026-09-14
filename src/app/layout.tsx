import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { InventoryProvider } from "@/components/inventory-provider";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "Inventory System Demo",
  description: "Barcode-enabled grocery inventory management demonstration",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={figtree.variable}>
        <InventoryProvider>{children}</InventoryProvider>
      </body>
    </html>
  );
}

