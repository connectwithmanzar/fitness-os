import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness OS",
  description: "Zero-Cost Autonomous Fitness & Nutrition Engine",
  applicationName: "Fitness OS",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitness OS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark bg-neutral-950 text-neutral-50 selection:bg-emerald-500 selection:text-black"
    >
      <body
        className={`${inter.className} min-h-dvh bg-neutral-950 pt-[env(safe-area-inset-top)] text-neutral-50`}
      >
        <main className="mx-auto min-h-dvh max-w-md overflow-y-auto scroll-smooth border-x border-neutral-800 bg-neutral-950 pb-[calc(9rem+env(safe-area-inset-bottom))] text-neutral-50 shadow-2xl">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
