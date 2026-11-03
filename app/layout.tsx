import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "JCT Financial OS | Jubail Corp. Trading Est.",
  description:
    "Financial management and cash register dashboard for wholesale paint distribution (Jotun, Hempel, Sigma).",
  manifest: "/manifest.json",
  applicationName: "JCT Financial OS",
  appleWebApp: {
    capable: true,
    title: "JCT Financial OS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/pwa-icon/180",
    icon: [
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Applies the saved theme before first paint to avoid a flash (defaults to dark).
const themeInit = `(function(){try{var t=localStorage.getItem('jct-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="JCT Financial OS" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/pwa-icon/180" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${jakarta.variable} font-sans min-h-full bg-slate-50 dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite selection:bg-jct-turquoise selection:text-jct-charcoal`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
