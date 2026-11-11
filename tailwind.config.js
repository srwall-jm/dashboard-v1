/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './views/**/*.{ts,tsx}'],
  // Some classes are built at runtime (bg-${color}-50, text-${align}), so they must be listed here.
  safelist: [
    { pattern: /^(bg|text)-(slate|indigo|emerald|amber|blue|orange|sky|violet|rose|purple|teal|cyan|pink|red|green|yellow)-(50|100|500|600)$/ },
    'text-left', 'text-right', 'text-center',
  ],
  theme: { extend: {} },
  plugins: [],
};
