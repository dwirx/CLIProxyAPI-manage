/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', 'ui-sans-serif', 'system-ui'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular']
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        proxy: {
          primary: '#14b8a6',
          secondary: '#f97316',
          accent: '#38bdf8',
          neutral: '#0b0f14',
          'base-100': '#0b0f14',
          'base-200': '#111720',
          'base-300': '#151c27',
          'base-content': '#f8fafc',
          info: '#38bdf8',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444'
        }
      }
    ]
  }
};
