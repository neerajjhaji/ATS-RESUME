import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 18px 44px -24px rgba(79,70,229,0.30)",
        "card-hover": "0 1px 2px rgba(16,24,40,0.05), 0 24px 52px -22px rgba(79,70,229,0.40)",
      },
      ringColor: {
        brand: "#6366f1",
      },
    },
  },
  plugins: [],
};

export default config;
