import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Engine",
  description: "Mobile-first workout logger and diet engine",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitness Engine",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950`}>
        <main className="mx-auto min-h-screen max-w-md overflow-y-auto scroll-smooth border-x border-neutral-800 bg-neutral-950 pb-36 text-neutral-50 shadow-2xl">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
