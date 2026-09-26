import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { DEFAULT_WEBSITE_CONFIG, mergeWebsiteConfig, rebrandLegacyText } from '../config/websiteCustomization';
import { normalizeImageUrl } from '../services/normalize';
import { reuseEqualBranches } from '../utils/reuseEqualBranches';
import { isWebsitePreview } from '../config/websiteDesigner';
import { SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY } from '../config/storeSettings';
import { BrandIdentityContext } from './BrandIdentityContext';
import { store } from '../store/store';
import { samiraApi } from '../store/apiSlice';
import { parseStoreSlug } from '../utils/attribution';

const WebsiteCustomizationContext = createContext(null);

export function WebsiteCustomizationProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_WEBSITE_CONFIG);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({});
  const [brandIdentityManaged, setBrandIdentityManaged] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const storeSlug = parseStoreSlug(typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`);
      const data = await api.get(`/website-config${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : ''}`, { cacheFirst: true });
      if (id !== requestId.current) return data;
      setConfig((current) => reuseEqualBranches(current, mergeWebsiteConfig(data.config)));
      setTheme((current) => reuseEqualBranches(current, data.theme || null));
      const nextMetadata = {
        ...(data.metadata || {}),
        title: rebrandLegacyText(data.metadata?.title),
        description: rebrandLegacyText(data.metadata?.description),
        image: /samira/i.test(String(data.metadata?.image || '')) ? '' : data.metadata?.image || '',
      };
      setMetadata((current) => reuseEqualBranches(current, nextMetadata));
      setBrandIdentityManaged(Boolean(data.brandIdentityManaged));
      return data;
    } catch {
      // Retain the last working configuration on refresh failure.
      return null;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isWebsitePreview()) { refresh(); return undefined; }
    const token = new URLSearchParams(window.location.search).get('token');
    const receive = (event) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin ||
        event.data?.type !== 'samira:theme-preview' || !token || event.data.token !== token) return;
      try { const next = mergeWebsiteConfig(event.data.config); setConfig((current) => reuseEqualBranches(current, next)); setLoading(false); } catch { /* Ignore malformed preview messages. */ }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [refresh]);

  useEffect(() => {
    if (isWebsitePreview()) return undefined;
    const storage = event => {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      store.dispatch(samiraApi.util.invalidateTags(['Settings', 'AdminSettings', 'WebsiteCustomization']));
      refresh();
    };
    const focus = () => refresh();
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);

  useEffect(() => {
    const name = String(metadata.title || config.branding.websiteName || '').trim();
    if (name) document.title = name;
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    if (description.dataset.originalContent === undefined) description.dataset.originalContent = description.content || '';
    description.content = metadata.description || description.dataset.originalContent;
    const setMeta = (attribute, key, value) => {
      let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.content = value;
    };
    const shareImage = normalizeImageUrl(metadata.image || config.branding.logo);
    setMeta('name', 'robots', metadata.indexing === false ? 'noindex,nofollow' : 'index,follow');
    if (name) {
      setMeta('property', 'og:title', name);
      setMeta('name', 'twitter:title', name);
    }
    if (description.content) {
      setMeta('property', 'og:description', description.content);
      setMeta('name', 'twitter:description', description.content);
    }
    if (shareImage) {
      setMeta('property', 'og:image', shareImage);
      setMeta('name', 'twitter:image', shareImage);
    }
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', shareImage ? 'summary_large_image' : 'summary');
    const href = normalizeImageUrl(config.branding.favicon);
    let favicon = document.querySelector('link[rel="icon"]');
    if (!href) {
      if (favicon?.dataset.originalHref) favicon.href = favicon.dataset.originalHref;
      return;
    }
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    if (!favicon.dataset.originalHref) favicon.dataset.originalHref = favicon.getAttribute('href') || '/favicon.ico';
    favicon.href = href;
  }, [config.branding.favicon, config.branding.logo, config.branding.websiteName, metadata.title, metadata.description, metadata.image, metadata.indexing]);

  const value = useMemo(() => ({ config, theme, loading, refresh, brandIdentityManaged }), [config, loading, refresh, theme, brandIdentityManaged]);
  const identity = useMemo(() => ({ ...config.branding, announcementEnabled: config.header.announcementEnabled, announcementText: config.header.announcementText, managed: brandIdentityManaged }), [config.branding, config.header.announcementEnabled, config.header.announcementText, brandIdentityManaged]);
  return <WebsiteCustomizationContext.Provider value={value}><BrandIdentityContext.Provider value={identity}>{children}</BrandIdentityContext.Provider></WebsiteCustomizationContext.Provider>;
}

export function useWebsiteCustomization() {
  const value = useContext(WebsiteCustomizationContext);
  if (!value) throw new Error('useWebsiteCustomization must be used inside WebsiteCustomizationProvider');
  return value;
}
