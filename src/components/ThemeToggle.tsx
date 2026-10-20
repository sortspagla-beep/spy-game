import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-300 focus:outline-none cursor-pointer ${
        isDark
          ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 shadow-inner'
          : 'bg-white hover:bg-slate-100 text-amber-500 border border-slate-200 shadow-sm'
      } ${className}`}
      title={isDark ? 'Switch to Day Mode ☀️' : 'Switch to Night Mode 🌙'}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        {isDark ? (
          <Moon className="w-4 h-4 text-indigo-300 transition-transform duration-300 transform rotate-0 scale-100" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 transform rotate-0 scale-100" />
        )}
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
