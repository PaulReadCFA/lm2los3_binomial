/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cfaBlue: "#4476FF",
        cfaDark: "#06005A",
      },
      fontFamily: {
        heading: ["Georgia", "serif"],
        body: ["Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
