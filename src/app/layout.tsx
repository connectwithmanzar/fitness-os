import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness OS",
  description: "Zero-Cost Autonomous Fitness & Nutrition Engine",
  applicationName: "Fitness OS",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
  colorScheme: "dark",
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
        <ErrorBoundary>
          <main className="relative z-0 mx-auto min-h-dvh max-w-md overflow-y-auto scroll-smooth bg-neutral-950 pb-[calc(9rem+env(safe-area-inset-bottom))] text-neutral-50 sm:border-x sm:border-neutral-800 sm:shadow-2xl">
            {children}
          </main>
        </ErrorBoundary>
        <BottomNav />
      </body>
    </html>
  );
}
