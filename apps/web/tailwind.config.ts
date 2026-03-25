import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eaf4ff",
          100: "#d4e8ff",
          200: "#accfff",
          300: "#7cb3ff",
          400: "#4a95ff",
          500: "#1977ff",
          600: "#005fdb",
          700: "#0048a5",
          800: "#003471",
          900: "#0b2141"
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
        glow: "0 24px 80px rgba(25, 119, 255, 0.18)"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Bricolage Grotesque", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;