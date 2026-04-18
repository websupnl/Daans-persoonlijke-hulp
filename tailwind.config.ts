import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Ethereal surface hierarchy ───────────────────────────────────────
        background:                 '#f9f9f8',
        surface:                    '#f9f9f8',
        'surface-bright':           '#ffffff',
        'surface-dim':              '#d7dbda',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f3f4f3',
        'surface-container':        '#eceeed',
        'surface-container-high':   '#e6e9e8',
        'surface-container-highest':'#dfe3e2',
        'surface-variant':          '#dfe3e2',

        // ── Text ─────────────────────────────────────────────────────────────
        'on-surface':               '#2f3333',
        'on-surface-variant':       '#5b605f',
        'on-background':            '#2f3333',

        // ── Outlines ──────────────────────────────────────────────────────────
        outline:                    '#777c7b',
        'outline-variant':          '#afb3b2',

        // ── Inverse ───────────────────────────────────────────────────────────
        'inverse-surface':          '#0c0f0e',
        'inverse-on-surface':       '#9c9d9c',

        // ── Status ────────────────────────────────────────────────────────────
        error:                      '#a83836',
        'error-container':          '#fa746f',
        'on-error':                 '#fff7f6',
        'on-error-container':       '#6e0a12',

        // ── Brand palette (pink primary) ──────────────────────────────────────
        brand: {
          50:  '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
      },

      fontFamily: {
        headline: ['Manrope', 'system-ui', 'sans-serif'],
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        body:     ['Inter', 'system-ui', 'sans-serif'],
        label:    ['Inter', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        DEFAULT: '0.25rem',
        sm:      '0.375rem',
        md:      '0.5rem',
        lg:      '0.75rem',
        xl:      '1rem',
        '2xl':   '1.25rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },

      boxShadow: {
        ambient:      '0 32px 32px -4px rgba(47,51,51,0.06)',
        'ambient-sm': '0 16px 24px -4px rgba(47,51,51,0.04)',
        'ambient-xs': '0 4px 12px -2px rgba(47,51,51,0.06)',
        float:        '0 -10px 40px -15px rgba(0,0,0,0.08)',
      },

      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)',
        'brand-subtle':   'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #f5f3ff 100%)',
      },
    },
  },
  plugins: [],
}

export default config
