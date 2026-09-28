import { draftReviewItems, runDraftSmartFillBatch } from './draftSmartFillBatch';
const entries = ['a', 'b', 'c'].map(id => ({ id }));
const completed = id => ({ success: true, data: { _id: id, smartFill: { state: 'completed' } } });
test('batch runs sequentially, paces requests, keeps successes and isolates an item failure', async () => {
  const order = []; const progress = jest.fn(); const wait = jest.fn(async () => {});
  const result = await runDraftSmartFillBatch({ entries, now: () => 100, wait, onProgress: progress, processDraft: async entry => {
    order.push(entry.id); if (entry.id === 'b') throw new Error('Bad photo'); return completed(entry.id);
  } });
  expect(order).toEqual(['a', 'b', 'c']); expect(wait).toHaveBeenCalledTimes(2);
  expect(result.map(item => item.state)).toEqual(['done', 'failed', 'done']);
});
test('quota failures pause rather than repeatedly spending requests on remaining products', async () => {
  const processDraft = jest.fn(async () => ({ success: false, code: 'AI_QUOTA_EXCEEDED', message: 'Quota exhausted', data: { _id: 'a' } }));
  const result = await runDraftSmartFillBatch({ entries, processDraft, onProgress: jest.fn() });
  expect(processDraft).toHaveBeenCalledTimes(1); expect(result[0].code).toBe('AI_QUOTA_EXCEEDED');
});
test('stop finishes the current save and does not start the next product', async () => {
  const controller = new AbortController(); const progress = jest.fn();
  const processDraft = jest.fn(async entry => { controller.abort(); return completed(entry.id); });
  const result = await runDraftSmartFillBatch({ entries, processDraft, onProgress: progress, signal: controller.signal });
  expect(processDraft).toHaveBeenCalledTimes(1); expect(result[0].state).toBe('done');
});
test('server-cached results reuse saved details without another analysis step', async () => {
  const result = await runDraftSmartFillBatch({ entries: [entries[0]], processDraft: async () => ({ ...completed('a'), cached: true }), onProgress: jest.fn() });
  expect(result[0].message).toMatch(/No AI call/);
});
test('category-specific required details count as missing but optional fields and zero stock do not block publishing', () => {
  const structure = { attributes: [{ key: 'metal', label: 'Metal', required: true }, { key: 'certificate', required: false }], categoryDefinitions: [{ key: 'rings', attributes: [{ key: 'ring_size', label: 'Ring size', required: true }] }] };
  const draft = { name: 'Ring', category: 'rings-id', sellingPrice: 300, originalPrice: 600, stock: 0, images: [{ url: 'a' }], attributeValues: { metal: 'Brass' } };
  expect(draftReviewItems(draft, structure, [{ _id: 'rings-id', name: 'Rings', definitionKey: 'rings' }])).toEqual(['Ring size']);
  for (const stock of [undefined, null, '', ' ']) expect(draftReviewItems({ ...draft, stock }, structure)).toContain('Stock');
});
