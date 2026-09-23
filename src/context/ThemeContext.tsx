import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'obsidian' | 'orbital-navy';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  tagline: string;
  bgClass: string;
  headerBg: string;
  cardBg: string;
  borderClass: string;
  accentGlow: string;
  badgeAccent: string;
  accentColor: string;
}

export const THEMES: Record<ThemeMode, ThemeConfig> = {
  'obsidian': {
    id: 'obsidian',
    name: 'Obsidian Midnight',
    tagline: 'Tactical Stealth Command • Ember & Flame High-Contrast',
    bgClass: 'bg-[#04060a]',
    headerBg: 'bg-[#070a12]/95',
    cardBg: 'bg-[#080d18]',
    borderClass: 'border-[#1b2336]',
    accentGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.12)]',
    badgeAccent: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    accentColor: '#f59e0b'
  },
  'orbital-navy': {
    id: 'orbital-navy',
    name: 'Orbital Deep Navy',
    tagline: 'NASA Space Operations • Cyan & Deep Cobalt Satellite Telemetry',
    bgClass: 'bg-[#050b16]',
    headerBg: 'bg-[#081224]/95',
    cardBg: 'bg-[#0a152d]',
    borderClass: 'border-[#192b4d]',
    accentGlow: 'shadow-[0_0_20px_rgba(56,189,248,0.14)]',
    badgeAccent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    accentColor: '#06b6d4'
  }
};

interface ThemeContextType {
  theme: ThemeMode;
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('wildfire_app_theme');
      if (saved === 'obsidian' || saved === 'orbital-navy') {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'obsidian';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('wildfire_app_theme', newTheme);
    } catch (e) {
      // ignore
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'obsidian' ? 'orbital-navy' : 'obsidian');
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-obsidian', 'theme-orbital-navy');
    root.classList.add(`theme-${theme}`);
    
    // Set custom dataset and meta theme-color for mobile viewports
    root.setAttribute('data-theme', theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'obsidian' ? '#04060a' : '#050b16');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeConfig: THEMES[theme], setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
