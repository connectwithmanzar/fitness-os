import type { Metadata, Viewport } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";
import "../../vendor/opengym/index.css";
import "@/styles/opengym-adapt.css";

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
  themeColor: "#000000",
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
    <html lang="en" className="dark">
      <body>
        <ErrorBoundary>
          <main id="app">{children}</main>
        </ErrorBoundary>
        <BottomNav />
      </body>
    </html>
  );
}
