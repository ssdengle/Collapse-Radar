import { Outlet, useLocation, Link, useNavigate } from "react-router";
import { NavLink } from "../components/router-components";
import { 
  LayoutDashboard, 
  Globe, 
  ShieldCheck, 
  Settings, 
  Menu,
  ChevronRight,
  ChevronLeft,
  Swords,
  BrainCircuit,
  Users,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "motion/react";

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <div className="flex h-screen bg-collapse-bg text-collapse-text overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="h-full bg-collapse-surface border-r border-collapse-border flex flex-col relative z-20 transition-all duration-300 ease-in-out shrink-0"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-collapse-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-collapse-accent to-collapse-purple flex items-center justify-center shrink-0 shadow-lg shadow-collapse-accent/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
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
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" isOpen={isSidebarOpen} />
        </nav>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-collapse-surface border border-collapse-border rounded-full flex items-center justify-center text-collapse-muted hover:text-collapse-accent hover:border-collapse-accent transition-colors shadow-sm z-50"
        >
          {isSidebarOpen ? <ChevronRight size={14} className="rotate-180" /> : <ChevronRight size={14} />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-collapse-bg relative">
        {/* Header */}
        <header className="h-16 bg-collapse-bg/80 backdrop-blur-md border-b border-collapse-border flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 text-collapse-muted">
             <Menu className="lg:hidden w-6 h-6 cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
             {/* Back button — shown on all non-home pages */}
             {!isHome && (
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
          : "text-collapse-muted hover:text-collapse-text hover:bg-collapse-surface/50"
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
