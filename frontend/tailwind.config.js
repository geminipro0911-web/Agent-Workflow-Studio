/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        surface: '#111827',
        surfaceLight: '#1F2937',
        border: '#374151',
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'violation-flash': 'violationFlash 1.2s ease-in-out infinite',
      },
      keyframes: {
        violationFlash: {
          '0%, 100%': {
            boxShadow: '0 0 15px 4px rgba(239, 68, 68, 0.7), inset 0 0 10px rgba(245, 158, 11, 0.4)',
            borderColor: '#ef4444'
          },
          '50%': {
            boxShadow: '0 0 25px 8px rgba(249, 115, 22, 0.9), inset 0 0 15px rgba(239, 68, 68, 0.6)',
            borderColor: '#f97316'
          }
        }
      }
    },
  },
  plugins: [],
}
