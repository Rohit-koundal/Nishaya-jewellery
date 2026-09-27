import { categoryId, categoryPath, findCategory, flattenCategories } from '../../utils/categoryHierarchy';
import { storefrontPath } from '../../utils/routing';

export default function CategoryBrowse({ categories = [], selected = '', navigate, storeSlug = '' }) {
  const current = !selected.includes(',') ? findCategory(selected, categories) : null;
  const path = current ? categoryPath(current, categories) : [];
  const children = flattenCategories(categories).filter((item) => categoryId(item.parent) === categoryId(current));
  const go = (category) => navigate(storefrontPath(category ? `/products?category=${encodeURIComponent(category.slug || categoryId(category))}` : '/products', storeSlug));
  return <section aria-label="Browse categories" className="mx-auto mb-3 max-w-[1500px] rounded-xl border border-slate-100 bg-white p-3 md:my-4 md:p-5">
    {path.length > 0 && <nav aria-label="Category breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><button type="button" className="min-h-8 hover:text-wine" onClick={() => go(null)}>All jewellery</button>{path.map((item, index) => <span className="flex items-center gap-2" key={categoryId(item)}><span aria-hidden="true">/</span><button type="button" className="min-h-8 font-semibold hover:text-wine" aria-current={index === path.length - 1 ? 'page' : undefined} onClick={() => go(item)}>{item.name}</button></span>)}</nav>}
    {children.length > 0 && <><h2 className="mb-2 text-sm font-bold text-slate-800">{current ? `Shop ${current.name} by type` : 'Shop by category'}</h2><div className="flex flex-wrap gap-2">{children.map((item) => <button type="button" key={categoryId(item)} onClick={() => go(item)} className="min-h-11 rounded-lg border border-[#ead8cb] bg-[#fffaf6] px-4 text-sm font-semibold text-wine hover:border-wine">{item.name}</button>)}</div></>}
  </section>;
}
