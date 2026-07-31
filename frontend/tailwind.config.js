/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Admin / staff back-office theme (Dashboard, POS, Kitchen, Waiter,
        // Super Admin, Login) — professional dark slate + teal ----
        ink: "#0B0F19",       // page background
        surface: "#121927",   // card surface
        surface2: "#1A2335",  // input / secondary surface
        marigold: {
          DEFAULT: "#2DD4BF", // teal accent — primary buttons, active nav, links
          dark: "#14B8A6",
          light: "#99F6E4",
        },
        cream: "#EEF2F8",     // primary light text on dark surfaces
        ash: "#8993A6",       // muted/secondary text
        clay: "#E2703A",      // secondary warm accent (e.g. "cooking" status)
        sage: "#34D399",      // success / paid / active
        chili: "#F87171",     // danger / cancelled

        // ---- Customer-facing digital menu theme — warm, restaurant-grade,
        // fully decoupled from the admin palette above ----
        menuBg: "#FBF4EA",
        menuCard: "#FFFFFF",
        menuInk: "#2A2118",
        menuMuted: "#8A7A68",
        menuBorder: "#EDE1D0",
        menuAccent: "#C1502B",     // primary CTA (Add, Place Order, Pay)
        menuAccentDark: "#9C3F21",
        menuGold: "#B8872F",       // secondary accent (veg dot, badges, prices)
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.25)",
        menu: "0 4px 20px rgba(42,33,24,0.08)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};





