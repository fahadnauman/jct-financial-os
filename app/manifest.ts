import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JCT Pocket",
    short_name: "JCT Pocket",
    description: "JCT owner mobile pocket: expenses, staff advances and roadside credit collections.",
    start_url: "/owner-pocket",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#040D0E",
    theme_color: "#040D0E",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
