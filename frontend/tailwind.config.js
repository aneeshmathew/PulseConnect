/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // ✅ darkMode: 'class' — Tailwind reads `dark` class from <html>, toggled in store
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1877F2',
          600: '#1565d8',
          700: '#1254be',
          800: '#0f44a3',
          900: '#0c3685',
          950: '#082660',
        },
        surface: {
          DEFAULT:   '#ffffff',
          'dark':    '#18191a',
          'dark-2':  '#242526',
          'dark-3':  '#3a3b3c',
        },
      },
      boxShadow: {
        card:      '0 1px 2px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.05)',
        'card-dark': '0 1px 2px rgba(0,0,0,.4)',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
      },
      animation: {
        shimmer:   'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up':'slideUp 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
