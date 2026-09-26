import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import api from '../services/api';
import { samiraApi } from '../store/apiSlice';
import { logout as logoutAction, selectUser, setCredentials, setUser as setUserAction } from '../store/authSlice';

export const AuthContext = createContext(null);

export function AuthProvider({ children, navigate }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [toast, setToastState] = useState(null);
  const sessionRevision = useRef(0);
  const profileRequest = useRef(0);

  const setToast = useCallback((value) => {
    if (!value) {
      setToastState(null);
      return;
    }

    if (typeof value === 'string') {
      setToastState({ message: value, type: 'info' });
      return;
    }

    setToastState({
      message: value.message || '',
      type: value.type || 'info',
      title: value.title || '',
    });
  }, []);

  const notify = useCallback((message, type = 'info', title = '') => {
    setToast({ message, type, title });
  }, [setToast]);

  const persist = useCallback((data) => {
    sessionRevision.current += 1;
    dispatch(setCredentials(data));
  }, [dispatch]);

  const resetSessionCache = useCallback(() => {
    dispatch(samiraApi.util.resetApiState());
  }, [dispatch]);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('samira_token');
    if (!token) return null;
    const revision = sessionRevision.current;
    const request = ++profileRequest.current;
    const isCurrent = () => revision === sessionRevision.current && request === profileRequest.current && !!localStorage.getItem('samira_token');
    try {
      const profile = await api.get('/auth/me');
      if (!isCurrent()) return null;
      dispatch(setUserAction(profile));
      return profile;
    } catch (error) {
      // A temporary profile fetch failure must not erase a saved session.
      if (isCurrent() && (error.status === 401 || error.status === 403)) {
        sessionRevision.current += 1;
        dispatch(logoutAction());
        dispatch(samiraApi.util.resetApiState());
      }
      return null;
    }
  }, [dispatch]);

  useEffect(() => {
    refreshProfile();
    return () => { profileRequest.current += 1; };
  }, [refreshProfile]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToastState(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onRefreshed = (event) => dispatch(setUserAction(event.detail));
    const onExpired = () => {
      sessionRevision.current += 1;
      dispatch(logoutAction());
      dispatch(samiraApi.util.resetApiState());
    };
    window.addEventListener('samira:session-refreshed', onRefreshed);
    window.addEventListener('samira:session-expired', onExpired);
    return () => {
      window.removeEventListener('samira:session-refreshed', onRefreshed);
      window.removeEventListener('samira:session-expired', onExpired);
    };
  }, [dispatch]);

  const sendOtp = useCallback((phone) => api.post('/auth/send-otp', { phone }), []);
  const resendOtp = useCallback((phone) => api.post('/auth/resend-otp', { phone }), []);

  const verifyOtp = useCallback(async ({ phone, otp, redirectTo = '/profile' }) => {
    let data = await api.post('/auth/verify-otp', { phone, otp });
    persist(data);

    const isAdminDestination = (String(redirectTo || '').startsWith('/admin') || String(redirectTo || '').startsWith('/master'))
      && !String(redirectTo || '').startsWith('//');
    if (isAdminDestination && data.user?.role === 'admin' && data.user?.activeMode !== 'admin') {
      try {
        data = await api.post('/auth/switch-mode', { mode: 'admin' });
        persist(data);
      } catch {
        // The protected route can still offer the safe manual mode switch.
      }
    }

    resetSessionCache();
    setToast(`Welcome ${data.user.name}`);
    navigate(redirectTo || '/profile');
    return data;
  }, [navigate, persist, resetSessionCache, setToast]);

  const switchMode = useCallback(async (mode, redirectTo = '') => {
    try {
      const data = await api.post('/auth/switch-mode', { mode });
      persist(data);
      resetSessionCache();
      setToast(mode === 'admin' ? 'Switched to Admin Mode' : mode === 'seller' ? 'Switched to Seller Mode' : 'Switched to Customer Mode');
      navigate(redirectTo || (mode === 'admin' ? '/admin' : mode === 'seller' ? '/seller' : '/'));
      return { ok: true };
    } catch (error) {
      setToast(error.message);
      return { ok: false, error: error.message };
    }
  }, [navigate, persist, resetSessionCache, setToast]);

  const updateProfile = useCallback(async (payload) => {
    const profile = await api.put('/auth/profile', payload);
    dispatch(setUserAction(profile));
    resetSessionCache();
    setToast('Profile updated successfully');
    return profile;
  }, [dispatch, resetSessionCache, setToast]);

  const sendProfilePhoneChangeOtp = useCallback((phone) => api.post('/auth/profile/send-phone-change-otp', { phone }), []);
  const verifyProfilePhoneChangeOtp = useCallback((payload) => api.post('/auth/profile/verify-phone-change-otp', payload), []);
  const sendProfileEmailChangeOtp = useCallback((email) => api.post('/auth/profile/send-email-change-otp', { email }), []);
  const verifyProfileEmailChangeOtp = useCallback((payload) => api.post('/auth/profile/verify-email-change-otp', payload), []);

  const deleteProfile = useCallback(async () => {
    const response = await api.delete('/auth/profile');
    sessionRevision.current += 1;
    dispatch(logoutAction());
    dispatch(samiraApi.util.resetApiState());
    try {
      localStorage.removeItem('samira_login_prompt_dismissed');
    } catch {
      // Ignore storage failures.
    }
    setToast(response?.message || 'Account deleted successfully');
    navigate('/');
    return response;
  }, [dispatch, navigate, setToast]);

  const logout = useCallback(() => {
    try { Promise.resolve(api.post('/auth/logout', {}, { silent: true })).catch(() => null); } catch { /* local logout must always complete */ }
    sessionRevision.current += 1;
    dispatch(logoutAction());
    dispatch(samiraApi.util.resetApiState());
    try {
      localStorage.removeItem('samira_login_prompt_dismissed');
    } catch {
      // Ignore storage failures.
    }
    navigate('/');
  }, [dispatch, navigate]);

  const value = useMemo(() => ({
    user,
    sendOtp,
    resendOtp,
    verifyOtp,
    switchMode,
    updateProfile,
    sendProfilePhoneChangeOtp,
    verifyProfilePhoneChangeOtp,
    sendProfileEmailChangeOtp,
    verifyProfileEmailChangeOtp,
    deleteProfile,
    refreshProfile,
    logout,
    toast,
    setToast,
    notify,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    activeMode: user?.activeMode || 'customer',
    availableModes: user?.availableModes || ['customer'],
  }), [deleteProfile, logout, notify, refreshProfile, resendOtp, sendOtp, sendProfileEmailChangeOtp, sendProfilePhoneChangeOtp, setToast, switchMode, toast, updateProfile, user, verifyOtp, verifyProfileEmailChangeOtp, verifyProfilePhoneChangeOtp]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed right-3 top-3 z-[100] w-[min(22rem,calc(100vw-1.5rem))] md:right-4 md:top-4">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left shadow-2xl transition ${
              toast.type === 'success'
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : toast.type === 'error'
                  ? 'border-red-700 bg-red-600 text-white'
                  : toast.type === 'warning'
                    ? 'border-amber-500 bg-amber-400 text-amber-950'
                    : 'border-slate-700 bg-slate-800 text-white'
            }`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" />
                : toast.type === 'error' ? <XCircle className="h-5 w-5" />
                  : toast.type === 'warning' ? <AlertTriangle className="h-5 w-5" />
                    : <Info className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-80">{toast.title}</p> : null}
              <p className={`${toast.title ? 'mt-1' : ''} text-sm font-semibold leading-5`}>{toast.message}</p>
            </div>
            <button type="button" onClick={() => setToast('')} className="shrink-0 rounded-lg p-1 hover:bg-black/10" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
