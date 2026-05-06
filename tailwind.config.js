/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        syn: {
          app: 'var(--syn-bg-app)',
          sidebar: 'var(--syn-bg-sidebar)',
          header: 'var(--syn-bg-header)',
          footer: 'var(--syn-bg-footer)',
          card: 'var(--syn-card)',
          elevated: 'var(--syn-elevated)',
          ink: 'var(--syn-text)',
          muted: 'var(--syn-text-muted)',
          border: 'var(--syn-border)',
          accent: 'var(--syn-accent)',
          hover: 'var(--syn-accent-hover)',
        },
        surface: {
          950: '#09090b',
          900: '#18181b',
          850: '#1f1f23',
          800: '#27272a',
          700: '#3f3f46',
          100: '#f4f4f5',
          50: '#fafafa',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
      backgroundImage: {
        'mesh-gradient':
          'radial-gradient(at 40% 20%, rgba(124, 58, 237, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(168, 85, 247, 0.1) 0px, transparent 45%)',
        'hero-dark':
          'linear-gradient(135deg, #09090b 0%, #18181b 40%, #1e1033 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
        'glass-light': '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        glow: '0 0 40px -10px rgba(139, 92, 246, 0.45)',
      },
      transitionDuration: {
        250: '250ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
