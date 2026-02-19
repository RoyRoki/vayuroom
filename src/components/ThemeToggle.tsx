import { useState, useEffect } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import './ThemeToggle.css';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
            return localStorage.getItem('theme') as Theme;
        }
        return 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove previous
        root.removeAttribute('data-theme');

        if (theme === 'system') {
            localStorage.removeItem('theme');
            // Browser handles media query automatically
            // But we might want to update meta theme-color dynamicallly if needed, 
            // though media query in index.html handles it mostly.
        } else {
            localStorage.setItem('theme', theme);
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    const cycleTheme = () => {
        const next: Record<Theme, Theme> = {
            'system': 'light',
            'light': 'dark',
            'dark': 'system'
        };
        setTheme(next[theme]);
    };

    const getIcon = () => {
        switch (theme) {
            case 'light': return <Sun size={18} />;
            case 'dark': return <Moon size={18} />;
            case 'system': return <Laptop size={18} />;
        }
    };

    const getLabel = () => {
        switch (theme) {
            case 'light': return 'Light';
            case 'dark': return 'Dark';
            case 'system': return 'System';
        }
    };

    return (
        <button
            className="theme-toggle btn btn-ghost btn-icon"
            onClick={cycleTheme}
            title={`Theme: ${getLabel()}`}
        >
            {getIcon()}
        </button>
    );
}
