import { Outlet, useLocation, Link, useNavigate } from "react-router";
import { NavLink } from "../components/router-components";
import { 
  LayoutDashboard, 
  Globe, 
  Menu,
  ChevronRight,
  ChevronLeft,
  Swords,
  BrainCircuit,
  Users,
  Radio,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { ThemeToggle } from "../components/ThemeToggle";
import { BackendStatusIndicator } from "../components/BackendStatusIndicator";

type LayoutProps = {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  backendConnected: boolean;
};

export function Layout({ theme, onToggleTheme, backendConnected }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  // War Room has its own "Back to matches" button — don't show the global one there
  const hasOwnBack = location.pathname === '/war-room';

  return (
    <div className="flex h-screen bg-white text-black dark:bg-[#050A14] dark:text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col relative z-20 transition-all duration-300 ease-in-out shrink-0"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <img src="/logo.png" alt="CollapseOS" className="w-9 h-9 rounded-lg shrink-0 object-contain" />
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="ml-3 font-bold text-lg tracking-tight whitespace-nowrap"
              >
                Collapse<span className="text-collapse-accent">OS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" isOpen={isSidebarOpen} />
          <NavItem to="/war-room" icon={<Swords size={20} />} label="War Room" isOpen={isSidebarOpen} />
          <NavItem to="/coach-view" icon={<BrainCircuit size={20} />} label="Coach View" isOpen={isSidebarOpen} />
          <NavItem to="/player-portal" icon={<Users size={20} />} label="Player Portal" isOpen={isSidebarOpen} />
          <NavItem to="/wc-2026" icon={<Globe size={20} />} label="WC 2026" isOpen={isSidebarOpen} />
          <NavItem to="/live-sim" icon={<Radio size={20} />} label="Live Sim" isOpen={isSidebarOpen} />
        </nav>

        {/* Theme + backend status */}
        <div className="mt-auto p-3 border-t border-slate-200 dark:border-slate-800">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <BackendStatusIndicator connected={backendConnected} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <BackendStatusIndicator connected={backendConnected} />
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-collapse-accent hover:border-collapse-accent transition-colors shadow-sm z-50"
        >
          {isSidebarOpen ? <ChevronRight size={14} className="rotate-180" /> : <ChevronRight size={14} />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-[#050A14] text-black dark:text-white relative">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-[#050A14]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 text-collapse-muted">
             <Menu className="lg:hidden w-6 h-6 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
             {/* Back button — shown on non-home pages that don't have their own back button */}
             {!isHome && !hasOwnBack && (
               <button
                 onClick={() => navigate(-1)}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-collapse-border bg-collapse-surface hover:border-collapse-accent hover:text-collapse-accent transition-all text-sm font-medium"
               >
                 <ChevronLeft className="w-4 h-4" />
                 Back
               </button>
             )}
             <div className="hidden md:flex items-center gap-2 text-sm">
                <Link to="/" className="text-collapse-muted hover:text-collapse-accent transition-colors">Home</Link>
                {!isHome && <ChevronRight className="w-3.5 h-3.5" />}
                {!isHome && (
                  <span className="text-collapse-text font-medium">
                    {location.pathname === '/wc-2026'
                      ? 'WC 2026'
                      : location.pathname.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                )}
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
           <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, isOpen }: { to: string, icon: React.ReactNode, label: string, isOpen: boolean }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
        isActive 
          ? "bg-collapse-accent/10 text-collapse-accent font-medium shadow-sm border border-collapse-accent/20" 
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70"
      )}
    >
      <span className="shrink-0 relative z-10">{icon}</span>
      <AnimatePresence>
        {isOpen && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="whitespace-nowrap relative z-10"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!isOpen && (
        <div className="absolute left-14 bg-collapse-surface border border-collapse-border px-3 py-1.5 rounded-md text-sm text-collapse-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg ml-2">
          {label}
        </div>
      )}
    </NavLink>
  );
}
