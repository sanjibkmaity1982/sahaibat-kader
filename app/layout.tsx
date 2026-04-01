import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SahAIbat Kader",
  description: "Alat triase klinis untuk Kader Posyandu",
  manifest: "/manifest.json",
  themeColor: "#02C39A",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SahAIbat",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ margin: 0, background: "#0D1F1C", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
```
