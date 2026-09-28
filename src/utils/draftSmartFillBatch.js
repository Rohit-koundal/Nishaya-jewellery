import { getActiveAttributeDefinitions } from './productAttributes';
const ACCOUNT_ERRORS = new Set(['AI_QUOTA_EXCEEDED', 'AI_ACCESS_DENIED', 'AI_MODEL_UNAVAILABLE', 'AI_CONNECTION_FAILED', 'AI_PROVIDER_UNAVAILABLE', 'AI_KEY_MISSING', 'SMART_FILL_UNAVAILABLE']);
export const SMART_FILL_INTERVAL_MS = 6000;
export const COPY_FIELDS = ['shortDescription', 'description', 'highlights', 'tags', 'metaTitle', 'metaDescription', 'metaKeywords'];

export function draftReviewItems(draft, structure, categories = []) {
  const missing = [];
  if (!draft.name?.trim()) missing.push('Product name');
  if (!draft.category) missing.push('Category');
  if (!(Number(draft.sellingPrice ?? draft.price) > 0)) missing.push('Selling price');
  if (!(Number(draft.originalPrice) > 0) || Number(draft.originalPrice) < Number(draft.sellingPrice ?? draft.price)) missing.push('Valid MRP');
  if (draft.stock == null || String(draft.stock).trim() === '' || !Number.isSafeInteger(Number(draft.stock)) || Number(draft.stock) < 0) missing.push('Stock');
  if (!(draft.images?.length || draft.image)) missing.push('Photos');
  for (const attribute of getActiveAttributeDefinitions(structure, categories, draft)) {
    if (attribute.required && !String(draft.attributeValues?.[attribute.key] || '').trim()) missing.push(attribute.label);
  }
  return missing;
}

export function waitForSmartFill(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Stopped')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.max(0, ms));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

// Server owns per-draft leases, input fingerprints, saving and conflict checks.
// Browser schedules bounded work only; stopping never cancels a committed save.
export async function runDraftSmartFillBatch({ entries, processDraft, onProgress, signal, pace = { nextAt: 0 }, wait = waitForSmartFill, now = Date.now }) {
  const results = [];
  for (const entry of entries) {
    if (signal?.aborted) break;
    try {
      if (pace.nextAt > now()) {
        onProgress({ id: entry.id, state: 'waiting', message: 'Waiting for the safe request interval...' });
        await wait(pace.nextAt - now(), signal);
      }
      if (signal?.aborted) break;
      onProgress({ id: entry.id, state: 'analyzing', message: 'Analysing and saving this draft...' });
      pace.nextAt = now() + SMART_FILL_INTERVAL_MS;
      // An issued server job finishes safely if Stop/navigation occurs. Its
      // persisted status is visible on refresh; no new jobs are then started.
      const response = await processDraft(entry);
      const draft = response.data;
      if (response.success === false) throw Object.assign(new Error(response.message || 'Smart Fill did not complete'), { code: response.code, draft });
      const metadata = draft.smartFill || {};
      const result = { id: entry.id, state: metadata.state === 'review' ? 'review' : 'done', draft,
        fields: metadata.fields || [], warnings: metadata.warnings || [], message: response.cached ? 'Unchanged analysis reused. No AI call needed.' : metadata.message || 'Details saved. Review before publishing.' };
      results.push(result); onProgress(result);
    } catch (error) {
      if (signal?.aborted) break;
      const code = error.code || error.data?.code;
      const status = error.status || error.data?.status;
      const failed = { id: entry.id, state: 'failed', ...(error.draft ? { draft: error.draft } : {}), message: error.data?.message || error.message || 'Could not fill this draft.', code };
      results.push(failed); onProgress(failed);
      if (ACCOUNT_ERRORS.has(code) || ['FETCH_ERROR', 'TIMEOUT_ERROR', 401, 403, 429].includes(status) || Number(status) >= 500) break;
    }
  }
  return results;
}
