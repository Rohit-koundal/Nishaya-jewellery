import { useEffect, useState } from 'react';

export default function StorefrontSkeleton({ variant = 'home', label = 'Loading the collection', className = '' }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  const block = 'motion-safe:animate-pulse rounded-xl bg-[#eee7e3]';
  return <section className={`bg-[rgb(var(--app-background-rgb,252_250_247))] px-3 py-4 ${className}`} role="status" aria-label={label} aria-busy="true" data-storefront-skeleton={variant}>
    <p className="sr-only" aria-live="polite">{slow ? 'Taking a little longer. You can still use the menu or browse another page.' : label}</p>
    {slow && <p className="mb-4 rounded-xl border border-[rgb(var(--app-border-rgb,234_223_213))] bg-white p-3 text-center text-xs text-slate-600">Taking a little longer to load. You can still use the menu.</p>}
    <div aria-hidden="true" className="space-y-5">
      {variant === 'home' && <>
        <div className={`${block} h-48 w-full sm:h-64`} />
        <div className="flex justify-around rounded-2xl bg-white p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><div className={`${block} mx-auto h-10 w-10 rounded-full`} /><div className={`${block} h-2 w-12`} /></div>)}</div>
        <div className="flex gap-4 overflow-hidden">{Array.from({ length: 5 }, (_, i) => <div key={i} className="shrink-0 space-y-2"><div className={`${block} h-16 w-16 rounded-full`} /><div className={`${block} h-2 w-16`} /></div>)}</div>
      </>}
      <div className={`${block} h-4 w-40`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: variant === 'home' ? 2 : 4 }, (_, i) => <div key={i} className="rounded-2xl bg-white p-2"><div className={`${block} aspect-[3/4] w-full`} /><div className={`${block} mt-3 h-3 w-4/5`} /><div className={`${block} mt-2 h-3 w-1/2`} /></div>)}</div>
    </div>
  </section>;
}
