import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark control-room surfaces
        dp: {
          bg: '#0B0E14',
          'surface-primary': '#111620',
          'surface-secondary': '#1A1F2E',
          'surface-elevated': '#232A3B',
          border: '#2A3144',
          'border-subtle': '#1E2536',
        },
        // State colors — restrained, professional
        state: {
          normal: '#22C55E',
          'normal-muted': '#166534',
          warning: '#F59E0B',
          'warning-muted': '#92400E',
          critical: '#EF4444',
          'critical-muted': '#991B1B',
          info: '#3B82F6',
          'info-muted': '#1E40AF',
          resolved: '#6B7280',
        },
        // Text hierarchy
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          tertiary: '#64748B',
          muted: '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      animation: {
        'node-activate': 'nodeActivate 300ms ease-out',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
      },
      keyframes: {
        nodeActivate: {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
