import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx,js,jsx,mdx}", "./components/**/*.{ts,tsx,js,jsx,mdx}", "./lib/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        monarch: {
          bg: "#F8F7F5",
          gold: "#C5A059",
          "gold-secondary": "#D9C8A9",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

