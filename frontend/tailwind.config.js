/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gc-green': '#21a038',
        'gc-green-dark': '#1a8030',
        'gc-green-light': '#f1f8e9',
        'gc-border': '#c8e6c9',
        'gc-text': '#1b5e20',
        'gc-text-light': '#558b2f',
      },
      fontFamily: {
        'sans': ['Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gc-green': '#21a038',
        'gc-green-dark': '#1a8030',
        'gc-green-light': '#f1f8e9',
        'gc-border': '#c8e6c9',
        'gc-text': '#1b5e20',
        'gc-text-light': '#558b2f',
      },
      fontFamily: {
        'sans': ['Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
