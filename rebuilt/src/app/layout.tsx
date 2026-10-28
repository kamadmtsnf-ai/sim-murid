import { PwaInstall, PwaSkipLink } from "@/components/pwa-install";
import type { Viewport, Metadata } from "next";
import { appConfig } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
  appleWebApp: { capable: true, title: "SiM-Murid", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    apple: "/pwa/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#125e64" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <PwaInstall><PwaSkipLink />{children}</PwaInstall>
      </body>
    </html>
  );
}
