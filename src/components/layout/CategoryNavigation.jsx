import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useGetCategoriesQuery } from '../../store/apiSlice';
import { categoryId, flattenCategories } from '../../utils/categoryHierarchy';

export function CategoryNavigation({ navigate, storeSlug = '', desktop = false }) {
  const { data: categories = [], isLoading, error, refetch } = useGetCategoriesQuery({ store: storeSlug }, { refetchOnMountOrArgChange: 60 });
  const ordered = flattenCategories(Array.isArray(categories) ? categories : []);
  const roots = ordered.filter((item) => !item.parent);
  const go = (category) => navigate(`/products?category=${encodeURIComponent(category.slug || categoryId(category))}`);
  return <nav aria-label="Shop by category" className={desktop ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-2'}>
    {isLoading ? <p role="status" className="p-3 text-sm text-slate-500">Loading categories…</p> : error ? <div role="alert" className="p-3 text-sm">Categories could not be loaded. <button type="button" className="font-bold text-wine underline" onClick={refetch}>Retry</button></div> : !roots.length ? <p className="p-3 text-sm text-slate-500">Categories will appear when they are published.</p> : roots.map((root) => {
      const rootIndex = ordered.findIndex((item) => categoryId(item) === categoryId(root));
      const endIndex = ordered.findIndex((item, index) => index > rootIndex && item.depth === 0);
      const branch = ordered.slice(rootIndex + 1, endIndex < 0 ? undefined : endIndex);
      return desktop ? <section key={categoryId(root)}>
        <button type="button" className="mb-2 min-h-11 text-left text-sm font-bold text-wine hover:underline" onClick={() => go(root)}>{root.name}</button>
        <ul className="space-y-1">{branch.map((item) => <li key={categoryId(item)} style={{ paddingLeft: `${Math.max(0, item.depth - 1) * 12}px` }}><button type="button" className="min-h-9 text-left text-sm text-slate-600 hover:text-wine hover:underline" onClick={() => go(item)}>{item.name}</button></li>)}</ul>
      </section> : <details key={categoryId(root)} className="rounded-xl border border-slate-100 bg-white" open={!branch.length || undefined}>
        <summary className="cursor-pointer px-3 py-3 text-sm font-bold text-slate-800">{root.name}</summary>
        <div className="border-t border-slate-100 p-2"><button type="button" className="block min-h-11 w-full px-2 text-left text-sm font-bold text-wine" onClick={() => go(root)}>View all {root.name}</button>{branch.map((item) => <button key={categoryId(item)} type="button" className="block min-h-11 w-full text-left text-sm text-slate-600" style={{ paddingLeft: `${item.depth * 12}px` }} onClick={() => go(item)}>{item.name}</button>)}</div>
      </details>;
    })}
  </nav>;
}

export default function CategoryMenu({ navigate, storeSlug = '', route }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  useEffect(() => { setOpen(false); }, [route]);
  return <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="sc-navbar__link" aria-expanded={open} aria-controls="desktop-category-menu" onClick={() => setOpen((value) => !value)}><span>Categories</span><ChevronDown size={14} /></button>
    {open && <div id="desktop-category-menu" className="absolute left-4 right-4 top-full z-50 max-h-[70vh] overflow-y-auto rounded-b-2xl border border-slate-100 bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3"><button type="button" onClick={() => { setOpen(false); navigate('/products'); }} className="text-sm font-bold text-wine">Shop all jewellery</button><button type="button" aria-label="Close categories" className="grid h-10 w-10 place-items-center" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></div>
      <CategoryNavigation desktop storeSlug={storeSlug} navigate={(path) => { setOpen(false); navigate(path); }} />
    </div>}
  </div>;
}
