import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { COPY_FIELDS, draftReviewItems, runDraftSmartFillBatch } from '../../utils/draftSmartFillBatch';
import { smartPhotos, SMART_FIELDS } from '../../utils/productSmartFill';
import { categoryLabel } from '../../utils/categoryHierarchy';
import { getActiveAttributeDefinitions } from '../../utils/productAttributes';
import DynamicAttributeField from './DynamicAttributeField';

const WORKING = new Set(['waiting', 'analyzing']);
const EMPTY_DEFAULTS = { category: '', sellingPrice: '', originalPrice: '', stock: '', supplierName: '', sharedNotes: '', language: 'English', tone: 'Clear and informative', attributeValues: {} };
const unpack = draft => ({ id: String(draft._id || draft.id), draft,
  state: ['completed', 'reviewed'].includes(draft.smartFill?.state) ? 'done' : draft.smartFill?.state === 'failed' ? 'failed' : draft.smartFill?.state === 'review' ? 'review' : 'pending',
  message: draft.smartFill?.message || '', fields: draft.smartFill?.fields || [], warnings: draft.smartFill?.warnings || [], dirty: false, edits: {} });
const blank = value => value === undefined || value === null || value === '';

export default function DraftBatchSmartFill({ drafts, categories, structure, apiPrefix, autoStart = false, onSave, onReview, onPublish, onClose, onRunningChange, onDirtyChange }) {
  const recoveryKey = `nishaya:draft-review:${apiPrefix}:${drafts[0]?.storeId || 'default'}:${drafts.map(draft => draft._id || draft.id).sort().join(',')}`;
  const [items, setItems] = useState(() => {
    let recovery = {}; try { recovery = JSON.parse(localStorage.getItem(recoveryKey) || '{}'); } catch { /* private browsing */ }
    return drafts.map(draft => {
      const item = unpack(draft); const saved = recovery[item.id];
      if (!saved) return item;
      if (Number(saved.revision) !== Number(draft.revision || 0)) return { ...item, recoveredEdits: saved.edits, message: 'Saved browser corrections are from an older revision. Review them below; current server data was kept.' };
      return { ...item, draft: { ...draft, ...saved.edits }, edits: saved.edits, dirty: true,
        ...(saved.edits?.supplierNotes !== undefined ? { state: 'review' } : {}), message: 'Unsaved browser corrections restored. Save them before publishing.' };
    });
  });
  const [selected, setSelected] = useState(() => drafts.map(draft => String(draft._id || draft.id)));
  const [defaults, setDefaults] = useState(EMPTY_DEFAULTS);
  const [refreshField, setRefreshField] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef(null); const alive = useRef(true); const started = useRef(false);
  const pace = useRef({ nextAt: 0 }); const heading = useRef(null);
  const presetKey = `nishaya:catalog-defaults:${apiPrefix}:${drafts[0]?.storeId || 'default'}`;
  const current = useRef(items); current.current = items;
  const dirty = items.some(item => item.dirty);
  const updateItem = progress => { if (alive.current) setItems(rows => rows.map(row => row.id === progress.id ? { ...row, ...progress } : row)); };

  useEffect(() => {
    alive.current = true; heading.current?.focus();
    return () => { alive.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!busy && !dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, dirty]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    try {
      const recovery = Object.fromEntries(items.filter(item => item.dirty || item.recoveredEdits).map(item => [item.id, { revision: item.recoveredEdits ? -1 : item.draft.revision || 0, edits: item.recoveredEdits || item.edits }]));
      if (Object.keys(recovery).length) localStorage.setItem(recoveryKey, JSON.stringify(recovery)); else localStorage.removeItem(recoveryKey);
    } catch { /* Completed server saves are not dependent on browser storage. */ }
  }, [items, dirty, recoveryKey, onDirtyChange]);
  const runRef = useRef(null);
  useEffect(() => {
    if (autoStart && structure && !started.current) { started.current = true; runRef.current?.(); }
  }, [autoStart, structure]);
  useEffect(() => {
    setItems(rows => rows.map(row => {
      const newer = drafts.find(draft => String(draft._id || draft.id) === row.id && Number(draft.revision || 0) > Number(row.draft.revision || 0));
      return newer && !row.dirty ? { ...row, ...unpack(newer) } : row;
    }));
  }, [drafts]);

  const begin = () => { if (request.current) return null; const controller = new AbortController(); request.current = controller; setBusy(true); setStopping(false); onRunningChange(true); return controller; };
  const finish = () => { request.current = null; if (alive.current) { setBusy(false); setStopping(false); onRunningChange(false); } };
  const persist = async item => {
    if (!item.dirty) return item;
    const body = { ...item.edits, baseRevision: Number(item.draft.revision || 0), saveMode: 'manual' };
    if (body.sellingPrice !== undefined) body.price = body.sellingPrice;
    const draft = await onSave(item.id, body);
    const saved = { ...item, ...unpack(draft), message: 'Your changes are saved.' };
    updateItem(saved); return saved;
  };
  const run = async onlyId => {
    if (!structure) return;
    const controller = begin(); if (!controller) return;
    try {
      const status = await api.get(`${apiPrefix}/products/smart-fill/status`, { silent: true, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!status.enabled) { setMessage('Photo AI is not configured. Configure Gemini on the backend, or fill verified supplier notes in an individual draft. No AI changes were made.'); return; }
      setMessage('Processing one product at a time. Keep this page open; each completed result is saved on the server.');
      const targets = current.current.filter(item => item.draft.status === 'draft' && (onlyId ? item.id === onlyId : selected.includes(item.id) && (refreshField || ['pending', 'failed', 'review'].includes(item.state))));
      await runDraftSmartFillBatch({ entries: targets, signal: controller.signal, pace: pace.current,
        processDraft: async item => {
          const saved = await persist(item);
          const originalNotes = saved.draft.supplierNotes || '';
          const shared = defaults.sharedNotes.trim();
          const notes = shared && !originalNotes.includes(shared) ? [originalNotes, shared].filter(Boolean).join('\n') : originalNotes;
          return api.post(`${apiPrefix}/product-drafts/${encodeURIComponent(item.id)}/smart-fill`, {
            notes, baseRevision: Number(saved.draft.revision || 0), refreshFields: refreshField === 'all' ? COPY_FIELDS : refreshField ? [refreshField] : [],
            copyPreferences: { language: defaults.language, tone: defaults.tone },
          }, { silent: true });
        }, onProgress: progress => updateItem({ ...progress, ...(progress.draft ? { dirty: false, edits: {} } : {}) }),
      });
      if (alive.current) setMessage(controller.signal.aborted ? 'Stopped safely. Saved drafts are retained. Continue unfinished products when ready.' : 'Run finished. Saved, failed and review items are shown below. Quota/account errors pause the batch; retry only after resolving the issue.');
    } catch (error) { if (alive.current && !controller.signal.aborted) setMessage(error.message || 'Smart Fill could not start.'); }
    finally { if (alive.current) setItems(rows => rows.map(row => WORKING.has(row.state) ? { ...row, state: 'pending' } : row)); finish(); }
  };
  runRef.current = () => run();
  const edit = (id, key, value) => setItems(rows => rows.map(row => row.id === id ? { ...row, draft: { ...row.draft, [key]: value }, edits: { ...row.edits, [key]: value }, dirty: true,
    ...(key === 'supplierNotes' ? { state: 'review', message: 'Source notes changed. Run Smart Fill or confirm the updated details before publishing.' } : {}),
  } : row));

  const saveEdits = async () => {
    if (!begin()) return;
    let failed = 0;
    for (const item of current.current.filter(row => row.dirty)) { try { await persist(item); } catch (error) { failed++; updateItem({ id: item.id, message: error.data?.message || error.message || 'Save failed. Reload before overwriting another edit.' }); } }
    setMessage(failed ? `${failed} saves need attention. Unsaved edits are still shown.` : 'All inline changes saved.'); finish();
  };
  const confirmReview = async item => {
    if (!begin()) return;
    try {
      const saved = await persist(item);
      const draft = await onSave(item.id, { baseRevision: Number(saved.draft.revision || 0), confirmSmartFillReview: true });
      updateItem({ id: item.id, draft, state: 'done', message: 'Details reviewed and confirmed.', dirty: false, edits: {} });
    } catch (error) { updateItem({ id: item.id, message: error.data?.message || error.message || 'Complete required information before confirming.' }); }
    finally { finish(); }
  };
  const applyDefaults = async () => {
    if (!begin()) return;
    let failed = 0;
    for (const item of current.current.filter(row => selected.includes(row.id) && row.draft.status === 'draft')) {
      try {
        const saved = await persist(item);
        const response = await api.get(`${apiPrefix}/product-drafts/${encodeURIComponent(item.id)}`, { silent: true });
        const latest = response?.data || response; const body = {};
        for (const field of ['category', 'sellingPrice', 'originalPrice', 'stock', 'supplierName']) {
          const absent = blank(latest[field]) || (['sellingPrice', 'originalPrice'].includes(field) && Number(latest[field]) === 0);
          if (!blank(defaults[field]) && absent && !(latest.variants?.length && ['category', 'stock'].includes(field))) body[field] = defaults[field];
        }
        const attributes = { ...latest.attributeValues };
        for (const [key, value] of Object.entries(defaults.attributeValues)) if (value && blank(attributes[key])) attributes[key] = value;
        if (JSON.stringify(attributes) !== JSON.stringify(latest.attributeValues || {})) body.attributeValues = attributes;
        if (body.sellingPrice !== undefined) body.price = body.sellingPrice;
        if (Object.keys(body).length) {
          const draft = await onSave(item.id, { ...body, baseRevision: Number(latest.revision || 0), saveMode: 'manual' });
          updateItem({ ...saved, draft, dirty: false, edits: {}, message: 'Verified defaults applied to empty fields.' });
        }
      } catch (error) { failed++; updateItem({ id: item.id, message: error.data?.message || error.message || 'Defaults could not be saved.' }); }
    }
    setMessage(failed ? `${failed} products could not receive defaults. See their errors below.` : 'Defaults saved for selected products. Existing values, including zero stock, were kept.'); finish();
  };
  const publish = async () => {
    if (!begin()) return;
    try {
      const targets = [];
      for (const item of current.current.filter(row => selected.includes(row.id) && row.draft.status === 'draft')) {
        try {
          const saved = await persist(item);
          if (!draftReviewItems(saved.draft, structure, categories).length && saved.state === 'done') targets.push(item.id);
        } catch (error) { updateItem({ id: item.id, state: 'review', message: error.data?.message || error.message || 'Save failed; this product was kept as a draft.' }); }
      }
      if (!targets.length) { setMessage('Selected products need required details or individual review before publication.'); return; }
      let response;
      try { response = await onPublish(targets); } catch (error) { response = error?.data; if (!response?.data?.results) throw error; }
      for (const result of response?.data?.results || []) {
        const item = current.current.find(row => row.id === result.id); if (!item) continue;
        updateItem({ id: item.id, message: result.message || 'Published successfully.', ...(result.status !== 'failed' ? { draft: { ...item.draft, status: 'published' }, state: 'published' } : { state: 'review' }) });
      }
      setMessage(response?.message || 'Publish results are shown against each product.');
    } catch (error) { setMessage(error.data?.message || error.message || 'Publication failed. Existing drafts were kept.'); }
    finally { finish(); }
  };
  const reload = async item => {
    if (!begin()) return;
    try {
      const response = await api.get(`${apiPrefix}/product-drafts/${encodeURIComponent(item.id)}`, { silent: true, forceRefetch: true });
      const draft = response?.data || response;
      updateItem({ ...unpack(draft), ...(item.dirty ? { recoveredEdits: item.edits, message: 'Latest server details loaded. Your unsaved corrections are retained below for comparison.' } : {}) });
    } catch (error) { updateItem({ id: item.id, message: error.message || 'Could not reload this draft.' }); }
    finally { finish(); }
  };
  const stateOf = item => item.draft.status === 'published' ? 'published' : item.state === 'failed' ? 'failed' : WORKING.has(item.state) ? 'processing' : (draftReviewItems(item.draft, structure, categories).length || item.state !== 'done') ? 'review' : 'ready';
  const count = key => items.filter(item => stateOf(item) === key).length;
  const pending = items.filter(item => item.draft.status === 'draft' && selected.includes(item.id) && (refreshField || ['pending', 'failed', 'review'].includes(item.state))).length;
  const completed = items.filter(item => ['done', 'published'].includes(item.state)).length;
  const selectedDrafts = items.filter(item => selected.includes(item.id) && item.draft.status === 'draft');

  return <section className="admin-card draft-smart-batch" aria-label="Batch Smart Fill">
    <div className="draft-panel-heading"><div><p>ASSISTED CATALOG SETUP</p><h2 ref={heading} tabIndex={-1}>Smart fill {items.length} product drafts</h2><span>Complete listing details with one review workspace. Existing facts stay protected.</span></div><button type="button" disabled={busy || items.some(item => item.dirty)} onClick={onClose} aria-label="Close batch Smart Fill"><X /></button></div>
    <details className="draft-smart-defaults"><summary>Shared details & reusable defaults (optional)</summary>
      <p>Only supply facts true for the selected products. Defaults fill empty fields; they do not overwrite product-specific values.</p>
      <div className="draft-form-grid four"><label className="draft-field"><span>Common category</span><select value={defaults.category} disabled={busy} onChange={event => setDefaults({ ...defaults, category: event.target.value })}><option value="">Do not set</option>{categories.map(category => <option key={category._id} value={category._id}>{categoryLabel(category, categories)}</option>)}</select></label>
        {['sellingPrice', 'originalPrice', 'stock'].map(field => <label key={field} className="draft-field"><span>{field === 'sellingPrice' ? 'Common selling price' : field === 'originalPrice' ? 'Common MRP' : 'Common stock'}</span><input type="number" min="0" step={field === 'stock' ? '1' : '0.01'} value={defaults[field]} disabled={busy} onChange={event => setDefaults({ ...defaults, [field]: event.target.value })} /></label>)}
        <label className="draft-field"><span>Supplier name</span><input value={defaults.supplierName} disabled={busy} onChange={event => setDefaults({ ...defaults, supplierName: event.target.value })} /></label>
        {(structure?.attributes || []).map(attribute => <label className="draft-field" key={attribute.key}><span>Common {attribute.label}</span>{attribute.options?.length ? <select disabled={busy} value={defaults.attributeValues[attribute.key] || ''} onChange={event => setDefaults({ ...defaults, attributeValues: { ...defaults.attributeValues, [attribute.key]: event.target.value } })}><option value="">Do not set</option>{attribute.options.map(option => <option key={option}>{option}</option>)}</select> : <input disabled={busy} value={defaults.attributeValues[attribute.key] || ''} maxLength={500} onChange={event => setDefaults({ ...defaults, attributeValues: { ...defaults.attributeValues, [attribute.key]: event.target.value } })} />}</label>)}
      </div>
      <label className="draft-field"><span>Shared supplier notes</span><textarea rows={3} maxLength={3500} value={defaults.sharedNotes} disabled={busy} onChange={event => setDefaults({ ...defaults, sharedNotes: event.target.value })} /></label>
      <p className="draft-inline-note">Shared notes go to each selected analysis. Different products/prices belong in their individual notes below.</p>
      <div className="draft-form-grid">{['language', 'tone'].map(key => <label className="draft-field" key={key}><span>Content {key}</span><input value={defaults[key]} maxLength={120} disabled={busy} onChange={event => setDefaults({ ...defaults, [key]: event.target.value })} /></label>)}</div>
      <div className="draft-smart-actions"><button className="admin-btn-ghost" type="button" disabled={busy || !selectedDrafts.length} onClick={applyDefaults}>Apply defaults to selected</button><button className="admin-btn-ghost" type="button" disabled={busy} onClick={() => { try { localStorage.setItem(presetKey, JSON.stringify(defaults)); setMessage('Defaults saved on this browser for this store.'); } catch { setMessage('Browser storage is unavailable.'); } }}>Save reusable defaults</button><button className="admin-btn-ghost" type="button" disabled={busy} onClick={() => { try { const saved = JSON.parse(localStorage.getItem(presetKey) || 'null'); if (saved) { setDefaults({ ...EMPTY_DEFAULTS, ...saved, category: categories.some(category => category._id === saved.category) ? saved.category : '' }); setMessage('Saved defaults loaded. Review, then apply to selected products.'); } else setMessage('No saved defaults on this browser.'); } catch { setMessage('Saved defaults could not be read.'); } }}>Load saved defaults</button></div>
    </details>
    <div className="draft-smart-actions"><label>Regenerate <select aria-label="Regenerate listing fields" disabled={busy} value={refreshField} onChange={event => setRefreshField(event.target.value)}><option value="">Only fill missing fields</option>{COPY_FIELDS.map(field => <option key={field} value={field}>{SMART_FIELDS[field]}</option>)}<option value="all">All listing copy & SEO</option></select></label>{refreshField && <span>Selected existing copy will be replaced. Other fields remain protected.</span>}</div>
    <div className="draft-smart-actions"><button type="button" className="admin-btn" onClick={() => run()} disabled={busy || !pending || !structure}><Sparkles size={16} />{completed ? `Continue Smart Fill (${pending})` : `Start Smart Fill (${pending})`}</button>{busy && <button type="button" className="admin-btn-ghost" disabled={stopping} onClick={() => { setStopping(true); request.current?.abort(); }}>{stopping ? 'Finishing current product...' : 'Stop after current product'}</button>}<button type="button" className="admin-btn-ghost" disabled={busy || !items.some(item => item.dirty)} onClick={saveEdits}>Save inline changes</button><button type="button" className="admin-btn" disabled={busy || !selectedDrafts.length || !structure} onClick={publish}>Publish selected ready products</button></div>
    {message && <p role="status" className="draft-alert">{message}</p>}
    <div className="draft-smart-actions"><strong>{count('ready')} ready · {count('review')} need review · {count('failed')} failed · {count('published')} published</strong><label>Show <select aria-label="Filter batch products" value={filter} onChange={event => setFilter(event.target.value)}>{['all', 'ready', 'review', 'failed', 'processing', 'published'].map(value => <option key={value}>{value}</option>)}</select></label><label><input type="checkbox" disabled={busy} checked={selected.length === items.length} onChange={event => setSelected(event.target.checked ? items.map(item => item.id) : [])} />Select all products</label></div>
    <progress aria-label="Smart Fill progress" value={completed} max={items.length || 1} />
    <div className="draft-smart-results">{items.filter(item => filter === 'all' || stateOf(item) === filter).map(item => {
      const photo = smartPhotos(item.draft)[0]; const missing = draftReviewItems(item.draft, structure, categories);
      return <article key={item.id} className="draft-smart-result">
        <div className="draft-smart-result__heading"><input aria-label={`Select batch ${item.draft.name || item.id}`} type="checkbox" disabled={busy || item.draft.status !== 'draft'} checked={selected.includes(item.id)} onChange={event => setSelected(rows => event.target.checked ? [...rows, item.id] : rows.filter(id => id !== item.id))} />{photo && <img src={normalizeImageUrl(photo)} alt="" loading="lazy" />}<div><strong>{item.draft.name || 'Unnamed product'}</strong><p>{item.message || 'Waiting for Smart Fill'}</p><small>{stateOf(item)}{item.dirty ? ' · Unsaved corrections' : ''}</small></div><button type="button" className="admin-btn-ghost" disabled={busy || item.dirty} onClick={() => onReview(item.draft)}>Full details</button><button type="button" className="admin-btn-ghost" disabled={busy || item.draft.status !== 'draft'} onClick={() => run(item.id)}>{item.state === 'failed' ? 'Retry this product' : 'Fill this product'}</button></div>
        <fieldset disabled={busy || item.draft.status !== 'draft'}><div className="draft-form-grid four"><label className="draft-field"><span>Product title</span><input value={item.draft.name || ''} maxLength={180} onChange={event => edit(item.id, 'name', event.target.value)} /></label><label className="draft-field"><span>Category</span><select value={item.draft.category?._id || item.draft.category || ''} onChange={event => { edit(item.id, 'category', event.target.value); edit(item.id, 'subCategory', ''); }}><option value="">Choose category</option>{categories.map(category => <option key={category._id} value={category._id}>{categoryLabel(category, categories)}</option>)}</select></label>{['sellingPrice', 'originalPrice', 'stock'].map(field => <label className="draft-field" key={field}><span>{field === 'sellingPrice' ? 'Selling price' : field === 'originalPrice' ? 'MRP' : 'Stock'}</span><input type="number" min="0" step={field === 'stock' ? '1' : '0.01'} value={item.draft[field] ?? ''} onChange={event => edit(item.id, field, event.target.value)} /></label>)}<label className="draft-field"><span>Supplier reference</span><input value={item.draft.supplierSku || ''} onChange={event => edit(item.id, 'supplierSku', event.target.value)} /></label></div>
          {getActiveAttributeDefinitions(structure, categories, item.draft).filter(attribute => attribute.required).map(attribute => <DynamicAttributeField key={attribute.key} attribute={attribute} value={item.draft.attributeValues?.[attribute.key] || ''} onChange={value => edit(item.id, 'attributeValues', { ...item.draft.attributeValues, [attribute.key]: value })} />)}
          <details><summary>Supplier notes & listing copy</summary><label className="draft-field"><span>Product-specific supplier notes</span><textarea rows={3} maxLength={7000} value={item.draft.supplierNotes || ''} onChange={event => edit(item.id, 'supplierNotes', event.target.value)} /></label>{['shortDescription', 'description', 'metaTitle', 'metaDescription', 'metaKeywords'].map(field => <label className="draft-field" key={field}><span>{SMART_FIELDS[field]}</span><textarea rows={field === 'description' ? 5 : 2} value={item.draft[field] || ''} maxLength={field === 'description' ? 6000 : 500} onChange={event => edit(item.id, field, event.target.value)} /></label>)}<label className="draft-field"><span>Highlights (one per line)</span><textarea value={(item.draft.highlights || []).join('\n')} onChange={event => edit(item.id, 'highlights', event.target.value.split('\n'))} /></label><label className="draft-field"><span>Tags</span><input value={(item.draft.tags || []).join(', ')} onChange={event => edit(item.id, 'tags', event.target.value.split(',').map(value => value.trim()))} /></label></details>
        </fieldset>
        {item.fields?.length > 0 && <p><strong>Updated:</strong> {item.fields.map(field => SMART_FIELDS[field] || field).join(', ')}</p>}
        {item.recoveredEdits && <details><summary>Older unsaved browser corrections (not applied)</summary><pre className="draft-smart-description">{JSON.stringify(item.recoveredEdits, null, 2)}</pre><button type="button" className="admin-btn-ghost" onClick={() => updateItem({ id: item.id, recoveredEdits: null })}>Discard old browser corrections</button></details>}
        {missing.length > 0 && <p className="draft-inline-note"><strong>Required:</strong> {missing.join(', ')}</p>}
        {item.state !== 'done' && item.draft.status === 'draft' && <button type="button" className="admin-btn-ghost" disabled={busy || !!missing.length} onClick={() => confirmReview(item)}>I have reviewed these details</button>}
        {item.draft.status === 'draft' && <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => reload(item)}>Reload saved details</button>}
        {!blank(item.draft.stock) && Number(item.draft.stock) === 0 && <p className="draft-inline-note">Stock is zero: this product will be unavailable to buy until stock is added.</p>}
        {item.warnings?.map(warning => <p key={warning} className="draft-inline-note">{warning}</p>)}
        {Object.keys(item.draft.smartFill?.fieldSources || {}).length > 0 && <details><summary>Suggestion sources — review inferred appearance</summary><ul>{Object.entries(item.draft.smartFill.fieldSources).map(([field, source]) => <li key={field}>{field}: {source.source === 'visual' ? 'Image-based suggestion' : 'Supplier / source statement'}{source.quote ? ` — ${source.quote}` : ''}</li>)}</ul></details>}
      </article>;
    })}</div>
    <p className="draft-inline-note">Uses existing Gemini quota and uploaded photos. Completed work is stored on the server. After refresh, select these drafts and reopen Smart Fill to continue; an interrupted running request can be resumed after 90 seconds. Publication always requires your explicit action.</p>
  </section>;
}
