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
        // ── Surface hierarchy (clean white base) ──────────────────────────────
        background:                 '#F5F5F5',
        surface:                    '#F5F5F5',
        'surface-bright':           '#FFFFFF',
        'surface-dim':              '#E5E7EB',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low':    '#F9FAFB',
        'surface-container':        '#F3F4F6',
        'surface-container-high':   '#E5E7EB',
        'surface-container-highest':'#D1D5DB',
        'surface-variant':          '#F3F4F6',

        // ── Text ──────────────────────────────────────────────────────────────
        'on-surface':               '#111111',
        'on-surface-variant':       '#6B7280',
        'on-background':            '#111111',

        // ── Outlines ──────────────────────────────────────────────────────────
        outline:                    '#9CA3AF',
        'outline-variant':          '#F0F0F0',

        // ── Inverse ───────────────────────────────────────────────────────────
        'inverse-surface':          '#111111',
        'inverse-on-surface':       '#F9FAFB',

        // ── Status ────────────────────────────────────────────────────────────
        error:                      '#EF4444',
        'error-container':          '#FEE2E2',
        'on-error':                 '#FFFFFF',
        'on-error-container':       '#7F1D1D',

        // ── Accent (indigo) ───────────────────────────────────────────────────
        accent:                     '#4F46E5',
        'accent-light':             '#EEF2FF',
        'accent-hover':             '#4338CA',
        'accent-text':              '#4F46E5',

        // ── AI (violet) ───────────────────────────────────────────────────────
        'ai-purple':                '#7C3AED',
        'ai-purple-bg':             '#F5F3FF',
        'ai-purple-border':         '#DDD6FE',

        // ── Semantic status ───────────────────────────────────────────────────
        success:                    '#10B981',
        'success-bg':               '#ECFDF5',
        warning:                    '#F59E0B',
        'warning-bg':               '#FFFBEB',
        'warning-border':           '#FDE68A',
        danger:                     '#EF4444',
        'danger-bg':                '#FEF2F2',

        // ── Brand palette (indigo) ────────────────────────────────────────────
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
      },

      fontFamily: {
        headline: ['Inter', 'system-ui', 'sans-serif'],
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        body:     ['Inter', 'system-ui', 'sans-serif'],
        label:    ['Inter', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        DEFAULT: '0.375rem',
        sm:      '0.375rem',
        md:      '0.5rem',
        lg:      '0.75rem',
        xl:      '1rem',
        '2xl':   '1.25rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },

      boxShadow: {
        sm:           '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        ambient:      '0 4px 12px rgba(0,0,0,0.06)',
        'ambient-sm': '0 2px 8px rgba(0,0,0,0.05)',
        'ambient-xs': '0 1px 4px rgba(0,0,0,0.04)',
        md:           '0 4px 12px rgba(0,0,0,0.08)',
        lg:           '0 8px 24px rgba(0,0,0,0.10)',
        float:        '0 -4px 16px rgba(0,0,0,0.06)',
        focus:        '0 0 0 3px rgba(79,70,229,0.15)',
      },

      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        'brand-subtle':   'linear-gradient(135deg, rgba(238,242,255,0.80) 0%, rgba(245,243,255,0.80) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
