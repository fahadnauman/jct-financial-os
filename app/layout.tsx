import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
  manifest: "/manifest.webmanifest",
  applicationName: "JCT Pocket",
  appleWebApp: {
    capable: true,
    title: "JCT Pocket",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  themeColor: "#2F2D2E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved theme before first paint to avoid a flash.
const themeInit = `(function(){try{var t=localStorage.getItem('jct-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-jct-offwhite dark:bg-[#222021] text-jct-charcoal dark:text-jct-offwhite selection:bg-jct-turquoise selection:text-jct-charcoal">
        {children}
      </body>
    </html>
  );
}
