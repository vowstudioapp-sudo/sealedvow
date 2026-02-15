/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luxury: {
          gold: '#D4AF37',
          'gold-dark': '#997B19',
          ivory: '#FCF9F7',
          paper: '#E3DAC9',
          sandstone: '#D4C5A5',
          studio: '#1C1917',
          obsidian: '#FAF6F1',
          twilight: '#1C1917',
          wine: '#582F2F',
          rose: '#C58B8B',
          bronze: '#8B5E3C',
          stone: '#444444',
          ink: '#2D2424',
        },
      },
    },
  },
  plugins: [],
}
