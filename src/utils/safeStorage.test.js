import { readLocal, removeLocal, writeLocal } from './safeStorage';
import { readScopedJson } from './userStorage';

const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
beforeEach(() => localStorage.clear());
afterEach(() => {
  Object.defineProperty(window, 'localStorage', originalStorage);
  jest.restoreAllMocks();
});

test('a blocked storage getter cannot crash auth module initialization or session updates', () => {
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } });
  expect(readLocal('samira_token')).toBeNull();
  expect(writeLocal('key', 'value')).toBe(false);
  expect(() => removeLocal('key')).not.toThrow();
  expect(readScopedJson('cart', ['legacy'], [])).toEqual([]);
  jest.isolateModules(() => {
    const { default: reducer, setCredentials, setUser, logout } = require('../store/authSlice');
    const initial = reducer(undefined, { type: 'init' });
    expect(initial).toEqual({ user: null, token: null, refreshToken: null });
    let state = reducer(initial, setCredentials({ user: { _id: 'one' }, token: 'access' }));
    expect(state.token).toBe('access');
    state = reducer(state, setUser({ _id: 'one', name: 'Customer' }));
    expect(state.user.name).toBe('Customer');
    expect(reducer(state, logout())).toEqual(initial);
  });
});

test('storage method failures also preserve guest startup', () => {
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    jest.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Storage unavailable'); });
  }
  expect(readLocal('key')).toBeNull();
  expect(writeLocal('key', 'value')).toBe(false);
  expect(() => removeLocal('key')).not.toThrow();
  expect(readScopedJson('cart', ['legacy'], [])).toEqual([]);
});

test('normal storage and legacy cart migration still work', () => {
  expect(writeLocal('legacy', '[1,2]')).toBe(true);
  expect(readScopedJson('cart', ['legacy'], [])).toEqual([1, 2]);
  expect(readLocal('legacy')).toBeNull();
  expect(readLocal('cart')).toBe('[1,2]');
});

test('a full storage quota does not erase a legacy cart during migration', () => {
  localStorage.setItem('legacy', '[1,2]');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  expect(readScopedJson('cart', ['legacy'], [])).toEqual([1, 2]);
  expect(localStorage.getItem('legacy')).toBe('[1,2]');
});

test('malformed saved user JSON does not prevent startup', () => {
  localStorage.setItem('samira_user', '{invalid');
  jest.isolateModules(() => {
    const { default: reducer } = require('../store/authSlice');
    expect(reducer(undefined, { type: 'init' }).user).toBeNull();
  });
});
