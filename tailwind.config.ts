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
        // Editorial serif for headlines (Whisky Advocate–style typography)
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        // Clean sans for body + UI
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        // Monospace for contract IDs, amounts
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      colors: {
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
        card: {
          DEFAULT:   'hsl(var(--card))',
          foreground:'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':       { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.3s ease-out',
        'slide-up':       'slide-up 0.4s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
