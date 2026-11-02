/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ps: {
          blue: '#0070d1',
          'blue-pressed': '#0064b7',
          'blue-active': '#004d8d',
          cyan: '#00f0ff',
          'link-dark': '#53b1ff',
          commerce: '#d53b00',
          'commerce-pressed': '#aa2f00',
          dark: '#000000',
          elevated: '#121314',
          card: '#181818',
          'card-hover': '#222228',
          border: 'rgba(255, 255, 255, 0.12)',
          'border-active': '#0070d1',
          gold: '#f5a623',
          'gold-start': '#ffce21',
          'gold-end': '#ee8e00',
        },
        table: {
          dark: '#05070e',
          felt: '#0b132b',
          border: '#0070d1',
          wood: '#1c2541',
          gold: '#f5a623'
        },
        uno: {
          red: '#ff5555',
          blue: '#0070d1',
          green: '#2ecc71',
          yellow: '#f5a623',
          dark: '#121314'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Be Vietnam Pro"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'ps': '8px',
        'ps-card': '16px',
        'ps-pill': '9999px',
      },
      boxShadow: {
        'ps-glow': '0 0 25px rgba(0, 112, 209, 0.45)',
        'ps-cyan': '0 0 20px rgba(0, 240, 255, 0.35)',
        'ps-card': '0 10px 30px rgba(0, 0, 0, 0.7)',
        'ps-gold': '0 0 25px rgba(245, 166, 35, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-short': 'bounce 0.8s ease-in-out infinite',
        'ps-float': 'psFloat 4s ease-in-out infinite',
        'ps-glow-pulse': 'psGlowPulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        psFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        psGlowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 112, 209, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 112, 209, 0.7)' },
        }
      }
    },
  },
  plugins: [],
}
