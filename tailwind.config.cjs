/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        racing: ['"Racing Sans One"', 'cursive', 'sans-serif'],
        display: ['Rajdhani', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        cyber: {
          neon: '#00f0ff',
          pink: '#ff007f',
          yellow: '#ffea00',
          purple: '#9400d3'
        }
      }
    },
  },
  plugins: [],
};

