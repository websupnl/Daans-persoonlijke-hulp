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
        background:                 '#f6f3ed',
        surface:                    '#f6f3ed',
        'surface-bright':           '#ffffff',
        'surface-dim':              '#d7d0c6',
        'surface-container-lowest': '#fffdfa',
        'surface-container-low':    '#f2eee7',
        'surface-container':        '#e9e3d8',
        'surface-container-high':   '#ddd5c9',
        'surface-container-highest':'#d1c8bc',
        'surface-variant':          '#ded6ca',

        // ── Text ─────────────────────────────────────────────────────────────
        'on-surface':               '#1f2523',
        'on-surface-variant':       '#5c615c',
        'on-background':            '#1f2523',

        // ── Outlines ──────────────────────────────────────────────────────────
        outline:                    '#7b756c',
        'outline-variant':          '#b0a79b',

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
        'brand-gradient': 'linear-gradient(135deg, #c86d40 0%, #a95470 48%, #5a677b 100%)',
        'brand-subtle':   'linear-gradient(135deg, rgba(248,239,231,0.95) 0%, rgba(244,233,239,0.95) 52%, rgba(233,237,244,0.95) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
