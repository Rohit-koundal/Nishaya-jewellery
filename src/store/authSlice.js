import { createSlice } from '@reduxjs/toolkit';
import { readLocal, removeLocal, writeLocal } from '../utils/safeStorage';

function readUser() {
  try {
    const stored = readLocal('samira_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    removeLocal('samira_user');
    return null;
  }
}

const initialState = {
  user: readUser(),
  token: readLocal('samira_token') || null,
  refreshToken: null,
};
removeLocal('samira_refresh_token');

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user, token } = action.payload || {};
      if (user) {
        state.user = user;
        writeLocal('samira_user', JSON.stringify(user));
      }
      if (token) {
        state.token = token;
        writeLocal('samira_token', token);
      }
      state.refreshToken = null;
      removeLocal('samira_refresh_token');
    },
    setUser(state, action) {
      state.user = action.payload;
      if (action.payload) writeLocal('samira_user', JSON.stringify(action.payload));
      else removeLocal('samira_user');
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      removeLocal('samira_user');
      removeLocal('samira_token');
      removeLocal('samira_refresh_token');
    },
  },
});

export const { logout, setCredentials, setUser } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export default authSlice.reducer;
