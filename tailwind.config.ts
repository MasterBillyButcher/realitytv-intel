import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0d10",
          900: "#12151a",
          800: "#1b1f26",
          700: "#262b34",
          600: "#3a4150",
          500: "#5b6474",
          400: "#8b93a1",
          300: "#b6bcc6",
          200: "#dadde2",
          100: "#eef0f2",
          50: "#f7f8f9"
        },
        accent: {
          700: "#8a3b1c",
          600: "#b04b22",
          500: "#c85a2c",
          400: "#dd7a4f",
          100: "#fbe7dc"
        },
        signal: {
          up: "#1c7a4d",
          down: "#a52424",
          neutral: "#5b6474"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "10px"
      },
      spacing: {
        "18": "4.5rem"
      }
    }
  },
  plugins: []
};

export default config;
