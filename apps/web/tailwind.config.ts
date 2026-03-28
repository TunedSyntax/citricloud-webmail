import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e0f2fe",
          100: "#bae6fd",
          200: "#7dd3fc",
          300: "#38bdf8",
          400: "#0ea5e9",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          800: "#0c4a6e",
          900: "#082f49"
        },
        surface: {
          50: "#f7fafe",
          100: "#edf3fb",
          200: "#dbe7f6",
          300: "#c3d5ea",
          400: "#8ba2bf",
          500: "#627792",
          600: "#475a73",
          700: "#314053",
          800: "#1f2937",
          900: "#131a22"
        }
      },
      boxShadow: {
        panel: "0 18px 40px rgba(10, 34, 70, 0.12)",
        glow: "0 24px 80px rgba(14, 165, 233, 0.2)"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Bricolage Grotesque", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;