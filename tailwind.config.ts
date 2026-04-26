import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-serif)', 'Georgia', 'serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#FAF7F2',
          100: '#F5EFE6',
          200: '#E8DDC8',
          300: '#D4C4A0',
        },
        oak: {
          600: '#5C4828',
          700: '#3E3019',
          800: '#2A1F0F',
          900: '#1A1308',
        },
        amber: {
          500: '#C9892F',
          600: '#A66B1F',
          700: '#7A4F18',
        },
        copper: {
          500: '#B5651D',
          600: '#964F0F',
        },
        success: {
          base: '#2D6A4F',
          bg: '#D8F3DC',
        },
        warning: {
          base: '#9A6914',
          bg: '#FFF3CD',
        },
        danger: {
          base: '#9A0F0F',
          bg: '#F8D7DA',
        },
        info: {
          base: '#1B4965',
          bg: '#D6E4F0',
        },
        ink: {
          900: '#1A1308',
          700: '#3E3019',
          500: '#6B5D4A',
          300: '#A89B85',
        },
        // Whisky Advocate–aligned: burgundy editorial + warm neutrals
        whisky: {
          50:  '#faf7f6',
          100: '#f3e9e8',
          200: '#e5d2d0',
          300: '#d0b2ae',
          400: '#b88682',
          500: '#965d58',
          600: '#7a3e3e',
          700: '#663033',
          800: '#54292c',
          900: '#3d1e20',
          950: '#211011',
        },
        // Brass / gold accent (masthead, eyebrow labels)
        brass: {
          50:  '#fcfbf7',
          100: '#f5efd9',
          200: '#eaddb8',
          300: '#dcc68a',
          400: '#c9a85c',
          500: '#b8923f',
          600: '#9a752f',
          700: '#7a5e28',
          800: '#624a22',
          900: '#3f3118',
          950: '#221a0c',
        },
        // WhiskyFest brand blue (#182d6d + tints)
        fest: {
          50:  '#eef1f9',
          100: '#dce2f0',
          200: '#b9c5e0',
          300: '#8a9ccc',
          400: '#5a70a8',
          500: '#3a5082',
          600: '#182d6d',
          700: '#14265c',
          800: '#101e4a',
          900: '#0c1638',
          950: '#070c20',
        },
        // Semantic tokens mapped to CSS vars (shadcn-style)
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:   'hsl(var(--primary))',
          foreground:'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:   'hsl(var(--secondary))',
          foreground:'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:   'hsl(var(--destructive))',
          foreground:'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:   'hsl(var(--muted))',
          foreground:'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:   'hsl(var(--accent))',
          foreground:'hsl(var(--accent-foreground))',
        },
        'accent-brand': 'hsl(var(--accent-brand) / <alpha-value>)',
        'bg-page': 'hsl(var(--bg-page) / <alpha-value>)',
        'bg-surface': 'hsl(var(--bg-surface) / <alpha-value>)',
        'bg-surface-raised': 'hsl(var(--bg-surface-raised) / <alpha-value>)',
        card: {
          DEFAULT:   'hsl(var(--card))',
          foreground:'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'wf-floating': '0 10px 40px -12px hsl(222 64% 26% / 0.18), 0 4px 16px -4px hsl(0 0% 0% / 0.08)',
        'wf-editorial':
          '0 1px 0 hsl(28 22% 18% / 0.06), 0 14px 48px -10px hsl(28 35% 8% / 0.14), 0 4px 12px -4px hsl(0 0% 0% / 0.08)',
        'wf-editorial-sm':
          '0 1px 0 hsl(28 20% 20% / 0.05), 0 6px 20px -6px hsl(28 30% 10% / 0.1)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':       { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'login-mount':    { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'wf-node-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--accent-brand) / 0.35)' },
          '50%': { boxShadow: '0 0 0 8px hsl(var(--accent-brand) / 0)' },
        },
        'wf-skeleton': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.85' },
        },
        'wf-pipeline-flash': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '40%': { opacity: '1', filter: 'brightness(1.06)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.3s ease-out',
        'slide-up':       'slide-up 0.4s ease-out',
        'login-mount':    'login-mount 0.6s ease-out both',
        'wf-node-pulse':  'wf-node-pulse 2s ease-in-out infinite',
        'wf-skeleton':    'wf-skeleton 1.6s ease-in-out infinite',
        'wf-pipeline-flash': 'wf-pipeline-flash 0.75s ease-out 1',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
