/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MacOS 26 inspired color palette
        'aura-dark': '#1c1c1e',
        'aura-darker': '#000000',
        'aura-gray': '#2c2c2e',
        'aura-light-gray': '#3a3a3c',
        'aura-blue': '#0a84ff',
        'aura-text': '#f5f5f7',
        'aura-text-secondary': '#98989d',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}