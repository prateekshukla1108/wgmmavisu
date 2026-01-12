/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'nvidia-green': 'rgba(118, 185, 0, 1)',
                'nvidia-green-dim': 'rgba(118, 185, 0, 0.3)',
                'nvidia-green-glow': 'rgba(118, 185, 0, 0.5)',
                'conflict-red': 'rgba(255, 50, 50, 1)',
                'conflict-red-dim': 'rgba(255, 50, 50, 0.3)',
                'cyber-blue': 'rgba(0, 200, 255, 1)',
                'cyber-blue-dim': 'rgba(0, 200, 255, 0.3)',
                'cyber-purple': 'rgba(180, 100, 255, 1)',
                'bg-dark': '#0f0f12',
                'bg-card': '#1a1a20',
                'bg-elevated': '#252530',
            },
            fontFamily: {
                'mono': ['JetBrains Mono', 'monospace'],
                'sans': ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'glow-green': '0 0 20px rgba(118, 185, 0, 0.4), 0 0 40px rgba(118, 185, 0, 0.2)',
                'glow-blue': '0 0 20px rgba(0, 200, 255, 0.4), 0 0 40px rgba(0, 200, 255, 0.2)',
                'glow-red': '0 0 20px rgba(255, 50, 50, 0.4), 0 0 40px rgba(255, 50, 50, 0.2)',
                'glow-purple': '0 0 20px rgba(180, 100, 255, 0.4), 0 0 40px rgba(180, 100, 255, 0.2)',
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'flow': 'flow 1.5s ease-in-out infinite',
                'scan': 'scan 3s linear infinite',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.6' },
                    '50%': { opacity: '1' },
                },
                'flow': {
                    '0%': { strokeDashoffset: '100' },
                    '100%': { strokeDashoffset: '0' },
                },
                'scan': {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' },
                },
            },
        },
    },
    plugins: [],
}
