import { Moon, Sun } from 'lucide-react';

type Props = {
  theme: 'dark' | 'light';
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 dark:border-slate-700 px-2.5 py-2 bg-white dark:bg-slate-900 transition-colors"
      aria-label="Toggle dark and light mode"
      title="Toggle theme"
    >
      <Moon className={`w-4 h-4 text-black dark:text-white ${isDark ? 'opacity-100' : 'opacity-40'}`} />
      <span className={`relative inline-flex h-5 w-10 rounded-full transition-colors ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform duration-200 ${
            isDark ? 'translate-x-0.5 bg-white' : 'translate-x-5 bg-black'
          }`}
        />
      </span>
      <Sun className={`w-4 h-4 text-black dark:text-white ${isDark ? 'opacity-40' : 'opacity-100'}`} />
    </button>
  );
}
