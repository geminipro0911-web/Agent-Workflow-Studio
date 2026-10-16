import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../i18n/translations';
import { NodeSkinTheme } from '../types/skins';

export type Theme = 'dark' | 'light';

interface ThemeLanguageContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  nodeSkin: NodeSkinTheme;
  setNodeSkin: (skin: NodeSkinTheme) => void;
  t: (key: keyof typeof translations.en, params?: Record<string, string | number>) => string;
}

const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state with localStorage persistence
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    return saved === 'light' ? 'light' : 'dark';
  });

  // Language state with localStorage persistence
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('lang') as Language;
    return saved === 'vi' ? 'vi' : 'en';
  });

  // Node display skin theme with localStorage persistence (Feudal, Capitalist, Cyberpunk, Corporate)
  const [nodeSkin, setNodeSkinState] = useState<NodeSkinTheme>(() => {
    const saved = localStorage.getItem('nodeSkin') as NodeSkinTheme;
    return saved || 'feudal';
  });

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save language to localStorage
  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  // Save nodeSkin to localStorage
  useEffect(() => {
    localStorage.setItem('nodeSkin', nodeSkin);
  }, [nodeSkin]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'vi' : 'en'));
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  const setNodeSkin = (newSkin: NodeSkinTheme) => {
    setNodeSkinState(newSkin);
  };

  const t = (key: keyof typeof translations.en, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.en;
    let text = dict[key] || translations.en[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return text;
  };

  return (
    <ThemeLanguageContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        language,
        toggleLanguage,
        setLanguage,
        nodeSkin,
        setNodeSkin,
        t,
      }}
    >
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export const useThemeLanguage = (): ThemeLanguageContextType => {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error('useThemeLanguage must be used within a ThemeLanguageProvider');
  }
  return context;
};
