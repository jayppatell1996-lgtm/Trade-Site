import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ededed',
        accent: '#00ff80',
        'accent-dim': '#00cc66',
        surface: '#141414',
        'surface-light': '#1a1a1a',
        border: '#2a2a2a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
