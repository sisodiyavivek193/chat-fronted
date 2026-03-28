/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                wa: {
                    bg: '#111B21',
                    sidebar: '#111B21',
                    panel: '#202C33',
                    chat: '#0B141A',
                    bubble_out: '#005C4B',
                    bubble_in: '#202C33',
                    green: '#00A884',
                    green_dark: '#008069',
                    text: '#E9EDEF',
                    text_secondary: '#8696A0',
                    border: '#2A3942',
                    search: '#202C33',
                    hover: '#2A3942',
                    icon: '#AEBAC1',
                },
            },
            fontFamily: {
                sans: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
            },
        },
    },
    plugins: [],
}