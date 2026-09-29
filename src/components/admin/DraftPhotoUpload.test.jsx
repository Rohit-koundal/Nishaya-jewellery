import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import DraftPhotoUpload from './DraftPhotoUpload';

test('bulk picker accepts large source photos before compression and preserves the original grouping reference', () => {
  const setFiles = jest.fn();
  render(<DraftPhotoUpload files={[]} setFiles={setFiles} onUpload={jest.fn()} onClose={jest.fn()} />);
  const photo = new File([new Uint8Array(5 * 1024 * 1024)], 'E100_front.jpg', { type: 'image/jpeg' });
  Object.defineProperty(photo, 'webkitRelativePath', { value: 'supplier/E100/E100_front.jpg' });
  fireEvent.change(screen.getByLabelText(/Choose product photos/), { target: { files: [photo] } });
  expect(setFiles).toHaveBeenCalledWith([photo]);
  expect(setFiles.mock.calls[0][0][0].webkitRelativePath).toBe('supplier/E100/E100_front.jpg');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Automatically compressed before upload/)).toBeInTheDocument();
});

test('unsupported or excessive source photos give an honest limit without replacing the selection', () => {
  const setFiles = jest.fn();
  render(<DraftPhotoUpload files={[]} setFiles={setFiles} onUpload={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Choose product photos/), { target: { files: [new File(['heic'], 'camera.heic', { type: 'image/heic' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('20MB');
  expect(setFiles).not.toHaveBeenCalled();
});
