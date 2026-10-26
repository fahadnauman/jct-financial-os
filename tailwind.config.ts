import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // Enable class-based dark mode
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        jct: {
          yellow: "#FFDE59",
          turquoise: "#2DE2E6",
          charcoal: "#2F2D2E",
          offwhite: "#F8F9FA",
        },
      },
    },
  },
  plugins: [],
};

export default config;
