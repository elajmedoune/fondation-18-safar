import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label="Changer de thème"
      className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
        isDark ? 'bg-primary-700' : 'bg-gray-200'
      }`}
      style={{ width: '52px' }}
    >
      <span
        className={`absolute flex h-5.5 w-5.5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
          isDark ? 'translate-x-[26px]' : 'translate-x-[3px]'
        }`}
        style={{ height: '22px', width: '22px' }}
      >
        {isDark ? <Moon size={12} className="text-primary-700" /> : <Sun size={12} className="text-amber-500" />}
      </span>
    </button>
  );
}