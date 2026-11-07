/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'rise-in': 'rise-in 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
      colors: {
        // Guest booking site — same theme as the staff login: green -> blue
        // accent on dark slate.
        brand: colors.green,
        navy: {
          950: colors.slate[950],
          900: colors.slate[900],
          800: colors.slate[800],
          700: colors.slate[700],
        },
      },
    },
  },
  plugins: [],
}
