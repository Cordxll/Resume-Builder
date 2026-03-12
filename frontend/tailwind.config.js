/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#809fff',
          500: '#667eea',
          600: '#5568d3',
          700: '#4451b8',
          800: '#373e9d',
          900: '#2d3282',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#764ba2',
          800: '#6b21a8',
          900: '#581c87',
        },
        dark: {
          bg: 'rgb(var(--color-dark-bg) / <alpha-value>)',
          surface: 'rgb(var(--color-dark-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-dark-elevated) / <alpha-value>)',
          border: 'rgb(var(--color-dark-border) / <alpha-value>)',
          hover: 'rgb(var(--color-dark-hover) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
        accent: {
          blue: 'rgb(var(--color-accent-blue) / <alpha-value>)',
          green: 'rgb(var(--color-accent-green) / <alpha-value>)',
          yellow: 'rgb(var(--color-accent-yellow) / <alpha-value>)',
          red: 'rgb(var(--color-accent-red) / <alpha-value>)',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
