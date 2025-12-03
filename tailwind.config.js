/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // These map to CSS variables for dynamic theming
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-variant': 'var(--color-surface-variant)',
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        'on-background': 'var(--color-on-background)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        'on-primary': 'var(--color-on-primary)',
        'on-primary-container': 'var(--color-on-primary-container)',
        outline: 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',
        error: 'var(--color-error)',
        'error-container': 'var(--color-error-container)',
        'on-error-container': 'var(--color-on-error-container)',
        // Audio quality colors
        'quality-hires': 'var(--color-quality-hires)',
        'quality-lossless': 'var(--color-quality-lossless)'
      }
    }
  },
  plugins: []
}
