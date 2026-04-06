import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center gap-2 bg-brand-surface border border-brand-border p-1 rounded-full w-14 h-8 transition-all duration-300 hover:border-brand-neon/40 group"
      aria-label="Toggle Theme"
    >
      <motion.div
        animate={{
          x: theme === 'dark' ? 24 : 0,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-6 h-6 rounded-full bg-brand-neon flex items-center justify-center shadow-lg z-10"
      >
        {theme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-brand-bg fill-current" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-brand-bg fill-current" />
        )}
      </motion.div>
      
      <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none">
        <Sun className={`w-3 h-3 transition-opacity duration-300 ${theme === 'dark' ? 'opacity-40' : 'opacity-0'}`} />
        <Moon className={`w-3 h-3 transition-opacity duration-300 ${theme === 'light' ? 'opacity-40' : 'opacity-0'}`} />
      </div>
    </button>
  );
};
