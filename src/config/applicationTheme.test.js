import { applyDocumentTheme, buildApplicationTheme, DEFAULT_COMPONENT_THEME } from './applicationTheme';
import { DEFAULT_WEBSITE_CONFIG, mergeWebsiteConfig } from './websiteCustomization';
import { applyAppearancePreset } from './websiteDesigner';
const { buildPresetConfig, getPresetList } = require('../../backend/config/websiteCustomization');

afterEach(() => { document.documentElement.removeAttribute('style'); document.documentElement.removeAttribute('data-app-theme'); });

test('Default preserves the existing mobile appearance even after non-appearance edits', () => {
  const config = mergeWebsiteConfig({ branding: { websiteName: 'My shop' }, theme: { enhancedStyles: true } });
  const appearance = buildApplicationTheme(config);
  expect(appearance.active).toBe(false);
  expect(appearance.variables).toEqual({});
  expect(appearance.componentTheme).toBe(DEFAULT_COMPONENT_THEME);
  expect(config.mobile).toEqual(DEFAULT_WEBSITE_CONFIG.mobile);
});

test('the real Indigo preset reaches global, legacy, portal and component-library tokens', () => {
  const preset = buildPresetConfig('indigo');
  const before = JSON.stringify(preset);
  const theme = buildApplicationTheme(preset);
  expect(theme.active).toBe(true);
  for (const token of ['--app-primary', '--site-primary', '--wine', '--rose']) expect(theme.variables[token]).toBe('#333b70');
  expect(theme.variables['--app-primary-rgb']).toBe('51 59 112');
  expect(theme.variables['--app-heading-font']).toContain('Georgia');
  expect(theme.variables['--font-auth-app']).toBe(theme.variables['--site-body-font']);
  expect(theme.componentTheme.colors.maroon).toHaveLength(10);
  expect(theme.componentTheme.colors.maroon[theme.componentTheme.primaryShade]).toBe('#333b70');
  expect(theme.variables['--app-on-primary']).toBe('#ffffff');
  expect(JSON.stringify(preset)).toBe(before);
});

test('custom header appearance also reaches handheld screens without requiring a named preset', () => {
  const result = buildApplicationTheme({ header: { background: '#eeeeff', textColor: '#333b70' } });
  expect(result.active).toBe(true);
  expect(result.variables['--site-header-background']).toBe('#eeeeff');
  expect(result.variables['--site-header-text']).toBe('#333b70');
});

test.each(getPresetList().map(preset => [preset.id, preset.config]))('%s preset has valid application tokens without changing its responsive layouts', (id, config) => {
  const before = JSON.stringify(config);
  const result = buildApplicationTheme(config);
  expect(result.active).toBe(id !== 'default');
  if (result.active) {
    expect(result.variables['--app-primary']).toMatch(/^#[a-f0-9]{6}$/i);
    expect(result.variables['--app-primary-rgb']).toMatch(/^\d+ \d+ \d+$/);
    expect(result.componentTheme.colors.maroon.every(color => /^#[a-f0-9]{6}$/i.test(color))).toBe(true);
  }
  expect(JSON.stringify(config)).toBe(before);
});

test('preset selection replaces handheld colors but preserves columns, crops and section choices', () => {
  const original = mergeWebsiteConfig({ mobile: { enabled: true, columns: 1, imageRatio: '3/4',
    headerBackground: '#990000', sections: [{ id: 'hero', visible: false }] } });
  const result = applyAppearancePreset(original, buildPresetConfig('indigo'));
  expect(result.mobile).toEqual({ ...original.mobile, headerBackground: result.header.background,
    headerText: result.header.textColor, pageBackground: result.colors.background });
  expect(result.homepage).toEqual(original.homepage);
  expect(result.layout).toEqual(original.layout);
});

test('switching back to Default restores original mobile colors rather than desktop colors', () => {
  const indigo = applyAppearancePreset(mergeWebsiteConfig(), buildPresetConfig('indigo'));
  const restored = applyAppearancePreset(indigo, buildPresetConfig('default'));
  expect(buildApplicationTheme(restored).active).toBe(false);
  expect(restored.mobile).toEqual(DEFAULT_WEBSITE_CONFIG.mobile);
});

test('document tokens cover body portals and cleanly restore Default without stale brand colors', () => {
  document.documentElement.style.setProperty('--wine', '#123456', 'important');
  const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = '#6d1f34'; document.head.append(meta);
  const undo = applyDocumentTheme(buildApplicationTheme(buildPresetConfig('indigo')));
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('#333b70');
  expect(document.documentElement.getAttribute('data-app-theme')).toBe('true');
  expect(meta.content).toBe('#333b70');
  undo();
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('');
  expect(document.documentElement.style.getPropertyValue('--wine')).toBe('#123456');
  expect(document.documentElement.style.getPropertyPriority('--wine')).toBe('important');
  expect(meta.content).toBe('#6d1f34');
  expect(document.documentElement.hasAttribute('data-app-theme')).toBe(false);
  meta.remove();
});

test('preview appearance only modifies its own document, never the parent admin page', () => {
  const preview = document.implementation.createHTMLDocument('Preview');
  const undo = applyDocumentTheme(buildApplicationTheme(buildPresetConfig('indigo')), preview.documentElement);
  expect(preview.documentElement.style.getPropertyValue('--app-primary')).toBe('#333b70');
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('');
  undo();
});

test('malformed palette values cannot create invalid derived styles or throw during startup', () => {
  expect(() => buildApplicationTheme({ colors: { primary: 'bad-color' } })).not.toThrow();
  expect(buildApplicationTheme({ colors: { primary: 'bad-color' } }).variables['--app-primary-rgb']).toBe('109 31 52');
});
