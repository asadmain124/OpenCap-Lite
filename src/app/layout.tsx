import type { Metadata } from "next";
import "./globals.css";

import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { DisclaimerFooter } from "@/components/app/DisclaimerFooter";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "OpenCap Lite",
  description:
    "Open-source cap-table modeling for SAFEs, notes, and priced rounds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 overflow-x-auto px-6 py-6">
              {children}
            </main>
          </div>
          <DisclaimerFooter />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
