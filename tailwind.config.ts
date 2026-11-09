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
      sm: '390px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        page: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        'border-control': 'var(--border-control)',
        'border-subtle': 'var(--border-subtle)',
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
      },
      borderRadius: {
        control: '8px',
        card: '12px',
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
        overlay: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
