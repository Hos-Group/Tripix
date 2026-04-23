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
        primary: {
          DEFAULT: '#6C47FF',
          light:   '#8B6FFF',
          dark:    '#5235E8',
          50:      '#F3F0FF',
          100:     '#E9E4FF',
          200:     '#D4CBFF',
          300:     '#B8A6FF',
          400:     '#9B7BFF',
          500:     '#6C47FF',
          600:     '#5235E8',
          700:     '#3D26B8',
        },
        surface: {
          DEFAULT:   '#FFFFFF',
          secondary: '#F7F8FA',
          muted:     '#F0F1F5',
          subtle:    '#FAFAFC',
        },
        ink: {
          900: '#0F0C28',
          800: '#1F1A3D',
          700: '#374151',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        popIn: {
          '0%':   { transform: 'scale(0.8)',  opacity: '0' },
          '70%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        // New: aurora background drift for hero sections
        aurora: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':      { transform: 'translate(15%, -10%) scale(1.1)' },
          '66%':      { transform: 'translate(-10%, 15%) scale(0.95)' },
        },
        // New: gentle pulse for AI / live indicators
        breathe: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.05)' },
        },
        // New: subtle floating for empty-state hero icon
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'slide-up':  'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':   'fadeIn 0.25s ease-out',
        'scale-in':  'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':   'shimmer 2s linear infinite',
        'pop-in':    'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'aurora':    'aurora 18s ease-in-out infinite',
        'breathe':   'breathe 2.4s ease-in-out infinite',
        'float':     'float 4s ease-in-out infinite',
      },
      boxShadow: {
        card:          '0 2px 16px rgba(0,0,0,0.06)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.10)',
        nav:           '0 -8px 30px rgba(0,0,0,0.05)',
        fab:           '0 8px 24px rgba(108,71,255,0.38)',
        'fab-active':  '0 4px 12px rgba(108,71,255,0.25)',
        glow:          '0 0 20px rgba(108,71,255,0.25)',
        // New depth scale
        'elev-1':      '0 1px 2px rgba(15,12,40,0.04), 0 2px 6px rgba(15,12,40,0.04)',
        'elev-2':      '0 2px 4px rgba(15,12,40,0.05), 0 6px 16px rgba(15,12,40,0.06)',
        'elev-3':      '0 4px 8px rgba(15,12,40,0.06), 0 12px 32px rgba(15,12,40,0.08)',
        'elev-4':      '0 8px 16px rgba(15,12,40,0.08), 0 24px 64px rgba(15,12,40,0.12)',
        // Color-tinted glows for premium feel
        'glow-violet': '0 8px 32px rgba(108,71,255,0.28), 0 0 0 1px rgba(108,71,255,0.08)',
        'glow-emerald':'0 8px 32px rgba(16,185,129,0.24), 0 0 0 1px rgba(16,185,129,0.08)',
        'glow-amber':  '0 8px 32px rgba(245,158,11,0.24), 0 0 0 1px rgba(245,158,11,0.08)',
        'glow-rose':   '0 8px 32px rgba(244,63,94,0.24),  0 0 0 1px rgba(244,63,94,0.08)',
        // Inner highlights
        'inner-top':   'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      backgroundImage: {
        'mesh-violet':  'radial-gradient(ellipse at top right, rgba(155,123,255,0.35), transparent 60%), radial-gradient(ellipse at bottom left, rgba(108,71,255,0.20), transparent 60%), linear-gradient(160deg, #EEE9FF 0%, #DDD4FF 60%, #C5B3FF 100%)',
        'mesh-aurora':  'radial-gradient(ellipse at 20% 30%, rgba(108,71,255,0.30), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(16,185,129,0.20), transparent 50%), linear-gradient(135deg, #F7F8FA 0%, #FAFAFC 100%)',
        'gradient-cta': 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        'gradient-danger':  'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
        'gradient-amber':   'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
      },
      transitionTimingFunction: {
        'spring-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'snap':       'cubic-bezier(0.2, 0.9, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
export default config
