import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snapdeal KAM Dashboard | Seller Growth & Resolution Assistant",
  description: "Virtual Key Account Manager for Snapdeal Sellers — Diagnostic and Action Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0d0e1c] text-slate-100 antialiased selection:bg-[#e40046] selection:text-white">
        {children}
      </body>
    </html>
  );
}
