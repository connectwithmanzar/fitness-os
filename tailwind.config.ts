import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        raised: "var(--surface)",
        inset: "var(--surface-2)",
        line: "var(--sep)",
        ink: "var(--label)",
        mute: "var(--label-2)",
        faint: "var(--label-3)",
        danger: "var(--red)",
        warn: "var(--orange)",
        accent: {
          DEFAULT: "var(--acc)",
          fg: "var(--on-acc)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "var(--r-card)",
        control: "var(--r)",
      },
      scale: {
        "975": "0.975",
        "98": "0.98",
      },
    },
  },
  plugins: [],
};

export default config;
