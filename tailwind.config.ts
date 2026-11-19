import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        page: '#F7F5EF',
        bg: { page: '#F7F5EF' },
        surface: '#FFFEFB',
        primary: {
          DEFAULT: '#244C40',
          hover: '#193B31',
          luxury: '#173C33',
        },
        accent: {
          DEFAULT: '#8C703C',
          hover: '#745B2D',
        },
        'text-main': '#283E35',
        'text-muted': '#6A756D',
        'border-control': '#B9C1B6',
        'border-subtle': '#E4E7DD',
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--bg-success)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--bg-warning)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--bg-danger)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--bg-info)',
        },
        focus: 'var(--color-focus)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        control: '10px',
        card: '18px',
      },
      minHeight: {
        touch: '44px',
        'touch-button': '48px',
        'touch-row': '64px',
      },
      minWidth: {
        touch: '44px',
      },
      spacing: {
        'touch-min': '44px',
        'header-h': '64px',
        'sidebar-w': '240px',
        'bottom-nav-h': '64px',
      },
      transitionDuration: {
        micro: '150ms',
      },
      boxShadow: {
        overlay: '0 24px 80px -16px rgba(23, 60, 51, 0.24)',
        card: '0 4px 24px -8px rgba(31, 58, 43, 0.09)',
      },
    },
  },
  plugins: [],
};

export default config;
