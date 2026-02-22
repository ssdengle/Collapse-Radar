type Props = {
  connected: boolean;
};

export function BackendStatusIndicator({ connected }: Props) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700">
      <span
        className={`h-2 w-2 rounded-full ${
          connected
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)] animate-pulse'
            : 'bg-red-500 opacity-70'
        }`}
      />
      <span className="text-[10px] font-semibold tracking-wide text-black dark:text-white">API</span>
    </div>
  );
}
