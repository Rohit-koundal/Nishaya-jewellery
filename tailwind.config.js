module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        wine: '#6D1F34',
        rose: '#FF5F86',
        blush: '#FFF0F4',
        ivory: '#FFFAF2',
        gold: '#B8914A',
        charcoal: '#17161A',
        brand: {
          soft: '#F8E8E4',
          primary: '#8A4A42',
          rose: '#DCA8A0',
          gold: '#C9A26F'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.08)'
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};
