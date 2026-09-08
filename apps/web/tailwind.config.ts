import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#7C5CFF",
          hover: "#8F73FF",
        },
        surface: {
          DEFAULT: "#0B0B0F",
          raised: "#141419",
          border: "#232329",
        },
      },
    },
  },
  plugins: [],
};

export default config;
