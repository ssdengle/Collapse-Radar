import { Link } from "../components/router-components";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 text-collapse-text">
      <h1 className="text-9xl font-bold text-collapse-surface/50 select-none">404</h1>
      <h2 className="text-2xl font-bold mt-4 font-sans tracking-tight">Page Not Found</h2>
      <p className="text-collapse-muted mt-2 max-w-md">The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
      <Link to="/" className="mt-8 px-6 py-3 bg-collapse-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg shadow-collapse-accent/20">
        Return Home
      </Link>
    </div>
  );
}
