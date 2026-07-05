/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // MARKA RENKLERİ RUNTIME'DAN (white-label): layout.js <html style> ile BRAND
        // kaydından --navy-rgb / --red-rgb (space-separated RGB kanalları) set edilir;
        // globals.css :root ProcessTürk fallback'i taşır. rgb(var(--x) / <alpha-value>)
        // sözdizimi Tailwind'in opacity modifier'ını KORUR (bg-navy/5, border-red/40 çalışır)
        // ve BRAND_ID değişince 56+ sınıf otomatik tenant rengine bürünür (hex gömülmez).
        navy: {
          DEFAULT: 'rgb(var(--navy-rgb) / <alpha-value>)',
          2: 'rgb(var(--navy2-rgb) / <alpha-value>)',
          3: 'rgb(var(--navy3-rgb) / <alpha-value>)',
        },
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)', // Industrial Blue
        red: 'rgb(var(--red-rgb) / <alpha-value>)',
        ok: 'rgb(var(--ok-rgb) / <alpha-value>)',
        amber: 'rgb(var(--amber-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
      },
      fontFamily: {
        head: ['Montserrat', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
