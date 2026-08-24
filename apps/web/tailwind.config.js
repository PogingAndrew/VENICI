/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effef7",
          100: "#d7fcea",
          300: "#7ff0c1",
          500: "#16c98a",
          600: "#0ea36e",
          700: "#0b7f57",
          900: "#0a3d2c",
        },
        ink: {
          900: "#0f1720",
          700: "#26313d",
          500: "#5b6b7a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
