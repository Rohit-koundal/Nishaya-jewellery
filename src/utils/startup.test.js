import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'public/index.html'), 'utf8');
const script = fs.readFileSync(path.resolve(process.cwd(), 'public/startup.js'), 'utf8');

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
});
afterEach(async () => {
  document.body.innerHTML = '';
  await Promise.resolve();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function start() { window.eval(script); }

test('initial HTML is meaningful before any React JavaScript executes', () => {
  expect(document.querySelector('#root h1').textContent).toBe('Opening the store');
  expect(document.getElementById('store-startup-retry').hidden).toBe(true);
  expect(html).toContain('async src="%PUBLIC_URL%/startup.js"');
  expect(html.indexOf('id="store-startup"')).toBeLessThan(html.indexOf('src="%PUBLIC_URL%/startup.js"'));
});

test('a slow or missing main bundle exposes manual recovery after a bounded wait', () => {
  start();
  jest.advanceTimersByTime(11999);
  expect(document.getElementById('store-startup-retry').hidden).toBe(true);
  jest.advanceTimersByTime(1);
  expect(document.getElementById('store-startup-retry').hidden).toBe(false);
  expect(document.querySelector('#root h1').textContent).toBe('Taking longer than expected');
});

test('script resource failure exposes recovery immediately', () => {
  start();
  const failedScript = document.createElement('script');
  document.body.appendChild(failedScript);
  failedScript.dispatchEvent(new Event('error'));
  expect(document.getElementById('store-startup-retry').hidden).toBe(false);
});

test('startup exceptions expose recovery without disclosing error details', () => {
  start();
  window.dispatchEvent(new ErrorEvent('error', { message: 'Private error detail' }));
  expect(document.getElementById('store-startup-retry').hidden).toBe(false);
  expect(document.body.textContent).not.toContain('Private error detail');
});

test('mounting React removes the watchdog and never overlays the running app', async () => {
  const removeListener = jest.spyOn(window, 'removeEventListener');
  start();
  document.getElementById('root').innerHTML = '<p>Store ready</p>';
  await Promise.resolve();
  expect(jest.getTimerCount()).toBe(0);
  expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function), true);
  jest.advanceTimersByTime(12000);
  expect(document.getElementById('root').textContent).toBe('Store ready');
});
