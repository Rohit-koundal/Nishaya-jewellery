import { compressImageFile, isSupportedImageFile, prepareImageUploads } from './imageCompression';
const mockLoadModule = jest.fn();
const mockCompress = jest.fn();
jest.mock('browser-image-compression', () => {
  mockLoadModule();
  return { __esModule: true, default: (...args) => mockCompress(...args) };
});

test('file validation and small WebP uploads do not load the compression library', async () => {
  expect(isSupportedImageFile({ name: 'image.jpg' })).toBe(true);
  const file = new File(['small'], 'small.webp', { type: 'image/webp' });
  expect(await compressImageFile(file)).toBe(file);
  expect(file.__compressionMeta.skipped).toBe(true);
  await expect(compressImageFile(new File(['x'], 'bad.txt', { type: 'text/plain' }))).rejects.toThrow('Only JPG');
  expect(mockLoadModule).not.toHaveBeenCalled();
});

test('compression module loads on first required upload and keeps worker/options behavior', async () => {
  mockCompress.mockResolvedValue(new Blob(['compressed'], { type: 'image/webp' }));
  const file = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  const progress = jest.fn();
  const result = await compressImageFile(file, { onProgress: progress });
  expect(mockLoadModule).toHaveBeenCalledTimes(1);
  expect(mockCompress).toHaveBeenCalledWith(file, expect.objectContaining({ useWebWorker: true, fileType: 'image/webp', onProgress: progress }));
  expect(result.name).toBe('photo.webp');
  expect(result.__compressionMeta.convertedToWebp).toBe(true);
});

test('compression failure is reported and another upload can retry', async () => {
  const file = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  mockCompress.mockRejectedValueOnce(new Error('Compression interrupted')).mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));
  await expect(compressImageFile(file)).rejects.toThrow('Compression interrupted');
  expect((await compressImageFile(file)).type).toBe('image/webp');
});

test('large WebP cannot bypass compression using the old 2MB threshold or metadata', async () => {
  const file = new File([new Uint8Array(1.5 * 1024 * 1024)], 'large.webp', { type: 'image/webp' });
  file.__compressionMeta = { skipped: true };
  mockCompress.mockResolvedValueOnce(new Blob(['optimized'], { type: 'image/webp' }));
  const result = await compressImageFile(file);
  expect(result).not.toBe(file); expect(result.size).toBeLessThan(0.7 * 1024 * 1024);
});

test('mixed evidence uploads compress photos and retain the unmodified video', async () => {
  const photo = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
  const video = new File(['video'], 'proof.mp4', { type: 'video/mp4' });
  mockCompress.mockResolvedValueOnce(new Blob(['optimized'], { type: 'image/webp' }));
  const result = await prepareImageUploads([photo, video], 'files');
  expect(result[0].type).toBe('image/webp'); expect(result[1]).toBe(video);
});

test('oversized or wrong-format compressor output fails closed instead of uploading originals', async () => {
  const photo = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
  mockCompress.mockResolvedValueOnce(new Blob([new Uint8Array(1024 * 1024)], { type: 'image/webp' }));
  await expect(compressImageFile(photo)).rejects.toThrow('original was not uploaded');
  mockCompress.mockResolvedValueOnce(new Blob(['png'], { type: 'image/png' }));
  await expect(compressImageFile(photo)).rejects.toThrow('original was not uploaded');
  await expect(compressImageFile(new File([new Uint8Array(21 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' }))).rejects.toThrow('20MB');
});

test('already-optimized WebP is not encoded repeatedly and extension-only images are normalized', async () => {
  const photo = new File([new Uint8Array(500 * 1024)], 'optimized.webp', { type: 'image/webp' });
  expect(await compressImageFile(photo)).toBe(photo);
  const untyped = new File(['jpeg'], 'camera.JPG');
  mockCompress.mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));
  await compressImageFile(untyped);
  expect(mockCompress.mock.calls.at(-1)[0].type).toBe('image/jpeg');
  expect(isSupportedImageFile(new File(['x'], 'fake.jpg', { type: 'text/plain' }))).toBe(false);
});
