/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2A46",
        paper: "#F2F4EE",
        stub: "#E9ECE1",
        amber: "#E8A33D",
        stamp: "#C1443C",
        moss: "#4C7A5E",
        line: "#C9CDBF",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        tag: "10px",
      },
    },
  },
  plugins: [],
};
