import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "#08090a",
          panel: "#0d0f11",
          raise: "#121518",
          line: "#1e2227",
          line2: "#2c3138",
          text: "#e7e9eb",
          muted: "#8b929b",
          faint: "#5b626b",
          amber: "#f0a35e",
          green: "#5cdb95",
          cyan: "#5fd0e3",
          violet: "#b49cff",
          red: "#ff6f6f",
          blue: "#7aa2ff",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.025) inset",
        glow: "0 0 24px -6px rgba(240,163,94,0.35)",
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
      },
      animation: {
        dash: "dash 1.1s linear infinite",
        "pulse-ring": "pulse-ring 2.8s ease-in-out infinite",
        "fade-up": "fade-up 160ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
