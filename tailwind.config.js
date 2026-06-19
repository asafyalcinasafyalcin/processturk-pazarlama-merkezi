/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ProcessTürk resmi tasarım sistemi
        navy: {
          DEFAULT: '#071739',
          2: '#0d2350',
          3: '#13315c',
        },
        ink: '#1F3B57', // Industrial Blue
        red: '#FF3255',
        ok: '#0f9e74',
        amber: '#b45309',
        line: '#e6eaf1',
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
