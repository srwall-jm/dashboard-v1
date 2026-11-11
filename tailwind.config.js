/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './views/**/*.{ts,tsx}'],
  // Some classes are built at runtime (bg-${color}-50, text-${align}), so they must be listed here.
  safelist: [
    { pattern: /^(bg|text)-(slate|indigo|emerald|amber|blue|orange|sky|violet|rose|purple|teal|cyan|pink|red|green|yellow)-(50|100|500|600)$/ },
    'text-left', 'text-right', 'text-center',
  ],
  theme: {
    extend: {
      // Jellyfish identity (from the Jellyfish deck template): DM Sans for text,
      // Big Shoulders Display for titles and large figures.
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Big Shoulders Display"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Neutral greys instead of Tailwind's blue-tinted slate, so every existing
        // slate class follows the Jellyfish palette.
        slate: {
          50: '#F7F7F7',
          100: '#F0F0F0',
          200: '#E6E6E6',
          300: '#C8C8C8',
          400: '#9E9E9E',
          500: '#6B6B6B',
          600: '#5A5A5A',
          700: '#3C3C3C',
          800: '#262626',
          900: '#141414',
          950: '#0A0A0A',
        },
        jf: {
          yellow: '#F8B133',
          'yellow-dark': '#E09E2D',
          gold: '#B07A10',
          'gold-light': '#F2D7A0',
          ink: '#141414',
          red: '#EA4335',
          green: '#37AA57',
        },
      },
    },
  },
  plugins: [],
};
