import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "#f2eee4",
          panel: "#faf7ef",
          raise: "#eae2d2",
          line: "#ded4c1",
          line2: "#c6b9a0",
          text: "#17130d",
          muted: "#564e42",
          faint: "#6f6657",
          amber: "#b23f24",
          green: "#39643f",
          cyan: "#1d5c67",
          violet: "#634070",
          red: "#9f2c1b",
          blue: "#26467e",
          highlight: "#e6bd5c",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
      boxShadow: {
        panel: "none",
        plate: "0 1px 2px rgba(23,19,13,0.05)",
        lift: "0 18px 40px -28px rgba(23,19,13,0.45)",
      },
      borderRadius: {
        card: "3px",
      },
      keyframes: {
        dash: {
          to: { strokeDashoffset: "-24" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.07", transform: "scale(1.25)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "marquee-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        dash: "dash 1.1s linear infinite",
        "pulse-ring": "pulse-ring 2.8s ease-in-out infinite",
        "fade-up": "fade-up 160ms ease-out both",
        "marquee-in": "marquee-in 520ms cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
