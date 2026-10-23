import type { Metadata } from "next";
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
};

// Applies the saved/system theme before first paint to avoid a flash (defaults to Jubail Corp obsidian dark).
const themeInit = `(function(){try{var t=localStorage.getItem('jct-theme');if(!t){t='dark'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} h-full antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-[#071314] text-white selection:bg-teal-500 selection:text-slate-950">{children}</body>
    </html>
  );
}
