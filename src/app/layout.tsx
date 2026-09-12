import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

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
  themeColor: "#0B0B0C",
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
      className={`${inter.variable} ${outfit.variable} dark bg-canvas text-ink selection:bg-accent selection:text-accent-fg`}
    >
      <body
        className={`${inter.className} min-h-dvh bg-canvas pt-[env(safe-area-inset-top)] font-sans text-ink`}
      >
        <ErrorBoundary>
          <main className="relative z-0 mx-auto min-h-dvh max-w-md overflow-y-auto scroll-smooth bg-canvas pb-[calc(7.5rem+env(safe-area-inset-bottom))] text-ink">
            {children}
          </main>
        </ErrorBoundary>
        <BottomNav />
      </body>
    </html>
  );
}
