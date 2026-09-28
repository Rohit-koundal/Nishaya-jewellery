import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DraftBatchSmartFill from './DraftBatchSmartFill';
import ProductPhotoGroups from './ProductPhotoGroups';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const category = { _id: 'cat', name: 'Earrings' };
const structure = { attributes: [{ key: 'metal_type', label: 'Metal type', required: true, type: 'dropdown', options: ['Brass', 'Alloy'] }], features: { sizing: false } };
const draft = { _id: 'draft-a', name: '', images: [{ url: '/uploads/earrings.jpg', primary: true }], price: 0, sellingPrice: 0, originalPrice: 0, status: 'draft', revision: 0, attributeValues: {} };
const filled = { ...draft, name: 'Clover earrings', category: 'cat', sellingPrice: 299, originalPrice: 599, stock: 2, attributeValues: { metal_type: 'Brass' }, shortDescription: 'Clover outlines in a gold-tone finish.', description: 'A clover silhouette with a defined outline.\n\nStyle it with a simple neckline.', highlights: ['Clover-shaped, open outline'], tags: ['clover'], metaTitle: 'Clover earrings', smartFill: { state: 'completed', message: 'Listing details saved.', fields: ['name', 'description', 'highlights'] }, revision: 1 };
const props = () => ({ drafts: [draft], categories: [category], structure, apiPrefix: '/admin', onSave: jest.fn(async (id, body) => ({ ...filled, ...body, _id: id, revision: 2 })), onReview: jest.fn(), onPublish: jest.fn(async ids => ({ message: 'Published', data: { results: ids.map(id => ({ id, status: 'published' })) } })), onClose: jest.fn(), onRunningChange: jest.fn() });
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); api.get.mockImplementation(async path => path.endsWith('/status') ? { enabled: true } : { data: draft }); api.post.mockResolvedValue({ success: true, data: filled }); });

test('upload auto-start runs full Smart Fill, shows rich copy and waits for explicit publication', async () => {
  const options = props(); render(<DraftBatchSmartFill {...options} autoStart />);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/product-drafts/draft-a/smart-fill', expect.objectContaining({ refreshFields: [] }), { silent: true }));
  await waitFor(() => expect(screen.getByLabelText('Product title')).toHaveValue('Clover earrings'));
  fireEvent.click(screen.getByText('Supplier notes & listing copy'));
  expect(screen.getByLabelText('Description')).toHaveValue(filled.description);
  expect(screen.getByLabelText('Highlights (one per line)')).toHaveValue('Clover-shaped, open outline');
  expect(options.onPublish).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish selected ready products' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected ready products' }));
  await waitFor(() => expect(options.onPublish).toHaveBeenCalledWith(['draft-a']));
});

test('reopening completed drafts does not automatically pay for another analysis', async () => {
  const options = props(); render(<DraftBatchSmartFill {...options} drafts={[filled]} />);
  expect(screen.getByLabelText('Product title')).toHaveValue('Clover earrings');
  expect(screen.getByRole('button', { name: 'Continue Smart Fill (0)' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Regenerate listing fields'), { target: { value: 'description' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue Smart Fill (1)' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ refreshFields: ['description'] }), expect.anything()));
});

test('inline edits save with revision and do not rewrite unrelated fields', async () => {
  const options = props(); render(<DraftBatchSmartFill {...options} drafts={[filled]} />);
  fireEvent.change(screen.getByLabelText('Product title'), { target: { value: 'Verified title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save inline changes' }));
  await waitFor(() => expect(options.onSave).toHaveBeenCalledWith('draft-a', { name: 'Verified title', baseRevision: 1, saveMode: 'manual' }));
  expect(api.post).not.toHaveBeenCalled();
});

test('shared defaults fill unknown stock and required specs but retain product-specific prices', async () => {
  const options = props(); api.get.mockResolvedValue({ data: { ...draft, sellingPrice: 999 } });
  render(<DraftBatchSmartFill {...options} />);
  fireEvent.click(screen.getByText('Shared details & reusable defaults (optional)'));
  fireEvent.change(screen.getByLabelText('Common selling price'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Common stock'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Common Metal type'), { target: { value: 'Brass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply defaults to selected' }));
  await waitFor(() => expect(options.onSave).toHaveBeenCalledWith('draft-a', expect.objectContaining({ stock: '5', attributeValues: { metal_type: 'Brass' }, baseRevision: 0 })));
  expect(options.onSave.mock.calls[0][1].sellingPrice).toBeUndefined();
});

test('missing required specs stay in review and cannot be published as ready', async () => {
  const options = props(); render(<DraftBatchSmartFill {...options} drafts={[{ ...filled, attributeValues: {} }]} />);
  expect(screen.getByText(/0 ready.*1 need review/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected ready products' }));
  expect(await screen.findByText(/Selected products need required details/)).toBeInTheDocument();
  expect(options.onPublish).not.toHaveBeenCalled();
});

test('photo group UI lets owner choose cover and split without upload or AI', () => {
  URL.createObjectURL = jest.fn(() => 'blob:photo'); URL.revokeObjectURL = jest.fn();
  const change = jest.fn(); const files = [{ name: 'front.jpg' }, { name: 'side.jpg' }];
  render(<ProductPhotoGroups files={files} groups={[{ id: 'g', reference: 'E100', signal: 'filename', fileIndexes: [0, 1] }]} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Make cover' }));
  expect(change.mock.calls[0][0][0].fileIndexes).toEqual([1, 0]);
  fireEvent.click(within(screen.getByAltText('side.jpg').closest('figure')).getByRole('button', { name: 'Separate product' }));
  expect(change.mock.calls[1][0].map(group => group.fileIndexes)).toEqual([[0], [1]]);
});

test('unsaved inline corrections recover after refresh without triggering AI', async () => {
  const options = props(); const page = render(<DraftBatchSmartFill {...options} drafts={[filled]} />);
  fireEvent.change(screen.getByLabelText('Product title'), { target: { value: 'My corrected title' } });
  page.unmount();
  render(<DraftBatchSmartFill {...options} drafts={[filled]} />);
  expect(screen.getByLabelText('Product title')).toHaveValue('My corrected title');
  expect(screen.getByText(/Unsaved browser corrections restored/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('changed supplier notes cannot retain a stale ready status after saving', async () => {
  const options = props();
  options.onSave.mockImplementation(async (id, body) => ({ ...filled, ...body, _id: id, revision: 2, smartFill: { state: 'review' } }));
  render(<DraftBatchSmartFill {...options} drafts={[filled]} />);
  fireEvent.click(screen.getByText('Supplier notes & listing copy'));
  fireEvent.change(screen.getByLabelText('Product-specific supplier notes'), { target: { value: 'Metal type: Alloy' } });
  expect(screen.getByText(/0 ready.*1 need review/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected ready products' }));
  expect(await screen.findByText(/Selected products need required details/)).toBeInTheDocument();
  expect(options.onPublish).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Start Smart Fill (1)' })).toBeEnabled();
});
