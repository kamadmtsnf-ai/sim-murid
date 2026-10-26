import { PwaInstall } from "@/components/pwa-install";
import type { Viewport, Metadata } from "next";
import { appConfig } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
  appleWebApp: { capable: true, title: "SiM-Murid", statusBarStyle: "default" },
  icons: { apple: "/pwa/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f766e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a href="#main-content" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Lewati ke konten utama
        </a>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
