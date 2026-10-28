import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appConfig.name,
    short_name: "SiM-Murid",
    description: appConfig.description,
    lang: "id",
    start_url: "/account",
    scope: "/",
    display: "standalone",
    categories: ["education", "productivity"],
    orientation: "any",
    background_color: "#f7f9fc",
    theme_color: "#125e64",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
