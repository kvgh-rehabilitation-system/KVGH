/** @type {import('tailwindcss').Config} */
import animate from 'tailwindcss-animate'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif TC"', '"Noto Sans TC"', 'serif'],
      },
      colors: {
        // shadcn 語意色（映射暖色系 CSS variables）
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // 專案暖色 palette
        cream: '#FAF7F2',
        parchment: '#F3EDE3',
        sand: '#EAE3D8',
        clay: {
          50: '#FAF1EC',
          100: '#F3DFD3',
          200: '#E7C3AE',
          300: '#DAA78A',
          400: '#D0916F',
          500: '#C67B5C',
          600: '#B06344',
          700: '#8F4F36',
          800: '#6E3D2A',
          900: '#4D2B1E',
        },
        sage: {
          50: '#F2F5EC',
          100: '#E2E9D4',
          200: '#C8D5AC',
          300: '#AEC086',
          400: '#9AAD77',
          500: '#8A9B6E',
          600: '#6F7F56',
          700: '#576343',
          800: '#3F4831',
          900: '#282E1F',
        },
        bark: {
          300: '#A99C8D',
          400: '#8A7B6A',
          500: '#6B5D4E',
          600: '#544838',
          700: '#3D3229',
          800: '#2B231C',
        },
        amberwarm: '#D9A441',
        rust: '#B5543B',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(61,50,41,0.04), 0 4px 16px rgba(61,50,41,0.06)',
        lifted:
          '0 2px 4px rgba(61,50,41,0.05), 0 12px 32px rgba(61,50,41,0.10), 0 24px 64px rgba(61,50,41,0.06)',
        glow: '0 0 0 1px rgba(198,123,92,0.14), 0 8px 32px rgba(198,123,92,0.18)',
        ring: '0 0 0 4px rgba(198,123,92,0.15)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        breathe: 'breathe 2s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
