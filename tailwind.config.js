/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/even-toolkit/dist/web/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          light: 'var(--color-surface-light)',
          lighter: 'var(--color-surface-lighter)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          dim: 'var(--color-text-dim)',
          muted: 'var(--color-text-muted)',
          highlight: 'var(--color-text-highlight)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          alpha: 'var(--color-accent-alpha)',
          warning: 'var(--color-accent-warning)',
        },
        positive: {
          DEFAULT: 'var(--color-positive)',
          alpha: 'var(--color-positive-alpha)',
        },
        negative: {
          DEFAULT: 'var(--color-negative)',
          alpha: 'var(--color-negative-alpha)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        'input-bg': 'var(--color-input-bg)',
        overlay: 'var(--color-overlay)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-default)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
};
