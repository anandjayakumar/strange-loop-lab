import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "#0a0a0b",
          panel: "#0f0f11",
          raise: "#151518",
          line: "#232326",
          line2: "#333338",
          text: "#eeedea",
          muted: "#a5a29c",
          faint: "#6d6a64",
          amber: "#e2a765",
          green: "#86c9a3",
          cyan: "#83b8c4",
          violet: "#b4a2d8",
          red: "#d97c73",
          blue: "#8ca8d4",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
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
