/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171C",       // primary dark background (kitchen/admin screens)
        surface: "#1D2229",   // card surface on dark
        surface2: "#252B33",
        cream: "#FAF6EF",     // customer-facing menu background
        marigold: {
          DEFAULT: "#F2A93B",
          dark: "#D98C1F",
          light: "#FBD68A",
        },
        clay: "#C1542C",
        sage: "#4CAE6F",
        chili: "#E5533D",
        ash: "#9AA1AC",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
