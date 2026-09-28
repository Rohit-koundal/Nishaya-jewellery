module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        wine: 'rgb(var(--app-primary-rgb, 109 31 52) / <alpha-value>)',
        rose: 'rgb(var(--app-primary-rgb, 255 95 134) / <alpha-value>)',
        blush: 'rgb(var(--app-secondary-rgb, 255 240 244) / <alpha-value>)',
        ivory: 'rgb(var(--app-background-rgb, 255 250 242) / <alpha-value>)',
        gold: 'rgb(var(--app-accent-rgb, 184 145 74) / <alpha-value>)',
        charcoal: 'rgb(var(--app-text-rgb, 23 22 26) / <alpha-value>)',
        brand: {
          soft: 'rgb(var(--app-secondary-rgb, 248 232 228) / <alpha-value>)',
          primary: 'rgb(var(--app-primary-rgb, 138 74 66) / <alpha-value>)',
          rose: 'rgb(var(--app-primary-rgb, 220 168 160) / <alpha-value>)',
          gold: 'rgb(var(--app-accent-rgb, 201 162 111) / <alpha-value>)'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.08)'
      },
      fontFamily: {
        display: ['var(--app-heading-font, "Playfair Display", serif)'],
        sans: ['var(--font-sans-app, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)']
      }
    }
  },
  plugins: []
};
