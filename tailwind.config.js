/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        notion: {
          text: '#37352f',
          bg: '#f7f6f3',
          hover: '#efedea',
          active: '#e3e1db',
          blue: '#2eaadc',
          red: '#eb5757',
          green: '#0f7b6c',
          yellow: '#dfab01',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica',
          'Apple Color Emoji', 'Arial', 'sans-serif',
          'Apple Color Emoji', 'Segoe UI Emoji', 'Microsoft YaHei',
        ],
        mono: ['SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
}
