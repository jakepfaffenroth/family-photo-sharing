const colors = require('tailwindcss/colors');

module.exports = {
  purge: {
    // enabled: true,
    content: ['./src/**/*.{vue,js,ts,jsx,tsx}', './public.{js,html}']
  },
  darkMode: 'media',
  theme: {
    fontFamily: {
      display: ['Work Sans', 'Helvetica Neue', 'ui-sans-serif'],
      sans: [
        'Lato',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'Noto Sans',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji'
      ]
    },
    extend: {
      spacing: { '46': '11rem', '90vw': '90vw', '70vw': '70vw' },
      padding: { '1/3': '33.33333%', '1/4': '25%', '1/5': '20%' },
      maxHeight: { '9/10': '90%', '80vh': '80vh' },
      maxWidth: { '50vw': '50vw', '90vw': '90vw' },
      colors: {
        teal: colors.teal,
        orange: colors.orange,
        gray: {
          450: '#84849a'
        }
      }
    }
  },
  variants: {
    extend: {
      translate: ['group-hover'],
      fontWeight: ['group-hover']
    }
  },
  plugins: []
};
