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

Commit message: `Add app/layout.tsx`

---

## Action 2 — Delete the root `layout.tsx`

1. Go back to the root of the repo
2. Click on `layout.tsx` (the one at root, NOT inside `app/`)
3. Click the **three dots `...`** menu (top right of the file view)
4. Click **Delete file**
5. Commit message: `Remove misplaced layout.tsx from root`

---

## After both actions, your `app/` folder should look like this:
```
app/
  globals.css   ✅
  layout.tsx    ✅  (just added)
  page.tsx      ✅
