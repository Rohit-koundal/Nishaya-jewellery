import { buildWebsiteCssVariables, DEFAULT_WEBSITE_CONFIG, mergeWebsiteConfig } from './websiteCustomization';

const hexColor = /^#[0-9a-f]{6}$/i;
const rgb = color => color.slice(1).match(/../g).map(value => parseInt(value, 16));
function mix(color, target, weight) {
  return '#' + rgb(color).map((value, index) => Math.round(value * (1 - weight) + rgb(target)[index] * weight).toString(16).padStart(2, '0')).join('');
}
function luminanceOf(color) {
  const channels = rgb(color).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function readableOn(color) {
  const luminance = luminanceOf(color);
  return (luminance + .05) / (luminanceOf('#17161a') + .05) > 1.05 / (luminance + .05) ? '#17161a' : '#ffffff';
}

export const DEFAULT_COMPONENT_THEME = {
  primaryColor: 'maroon', primaryShade: 8, defaultRadius: 'md',
  fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
  headings: { fontFamily: '"Playfair Display", Georgia, serif' },
  colors: { maroon: ['#f9ecef', '#f2d8de', '#e8bcc8', '#db93a6', '#cc6d87', '#ba4668', '#a92d4f', '#951c3e', '#7b1834', '#5f1128'] },
};

// One palette for storefront, workspace, responsive screens and body portals.
// Layout/card visibility remain scoped to their existing device settings.
export function buildApplicationTheme(input) {
  const config = mergeWebsiteConfig(input);
  const active = config.theme.preset !== 'default' || ['colors', 'typography', 'buttons'].some(group =>
    Object.keys(config[group]).some(key => config[group][key] !== DEFAULT_WEBSITE_CONFIG[group][key]))
    || [['header', 'background'], ['header', 'textColor'], ['footer', 'background'], ['footer', 'textColor'],
      ['productCards', 'borderRadius'], ['productCards', 'shadow']].some(([group, key]) => config[group][key] !== DEFAULT_WEBSITE_CONFIG[group][key]);
  if (!active) return { active: false, variables: {}, componentTheme: DEFAULT_COMPONENT_THEME };

  const colors = Object.fromEntries(Object.entries(config.colors).map(([key, value]) => [key,
    hexColor.test(value) ? value : DEFAULT_WEBSITE_CONFIG.colors[key]]));
  const site = buildWebsiteCssVariables({ ...config, colors });
  const variables = { ...site };
  for (const [key, color] of Object.entries(colors)) {
    const name = key === 'mutedText' ? 'muted' : key;
    variables[`--app-${name}`] = color;
    variables[`--app-${name}-rgb`] = rgb(color).join(' ');
  }
  const deep = mix(colors.primary, '#000000', .2);
  const border = mix(colors.surface, colors.primary, .16);
  Object.assign(variables, {
    '--app-primary-deep': deep, '--app-primary-deep-rgb': rgb(deep).join(' '),
    '--app-primary-hover': mix(colors.primary, '#000000', .1),
    '--app-on-primary': readableOn(colors.primary),
    '--app-border': border, '--app-border-rgb': rgb(border).join(' '),
    '--app-heading-font': site['--site-heading-font'],
    '--app-body-font': site['--site-body-font'],
    '--font-sans-app': site['--site-body-font'], '--font-auth-app': site['--site-body-font'],
    '--wine': colors.primary, '--rose': colors.primary, '--blush': colors.secondary,
    '--ivory': colors.background, '--gold': colors.accent, '--charcoal': colors.text, '--text-body': colors.text,
  });
  return {
    active: true, variables,
    componentTheme: {
      ...DEFAULT_COMPONENT_THEME, primaryShade: 6, autoContrast: true, fontFamily: site['--site-body-font'],
      headings: { fontFamily: site['--site-heading-font'] },
      colors: { maroon: [.94, .86, .72, .55, .36, .18].map(weight => mix(colors.primary, '#ffffff', weight))
        .concat(colors.primary, mix(colors.primary, '#000000', .12), mix(colors.primary, '#000000', .24), mix(colors.primary, '#000000', .36)) },
    },
  };
}

export function applyDocumentTheme(appearance, root = document.documentElement) {
  const previousAttribute = root.getAttribute('data-app-theme');
  const previous = Object.entries(appearance.variables).map(([key, value]) => {
    const saved = [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)];
    if (value !== undefined) root.style.setProperty(key, String(value));
    return saved;
  });
  root.setAttribute('data-app-theme', String(appearance.active));
  const chrome = root.ownerDocument.querySelector('meta[name="theme-color"]');
  const previousChrome = chrome?.content;
  if (appearance.active && chrome) chrome.content = appearance.variables['--app-primary'];
  return () => {
    previous.forEach(([key, value, priority]) => value ? root.style.setProperty(key, value, priority) : root.style.removeProperty(key));
    if (previousAttribute === null) root.removeAttribute('data-app-theme');
    else root.setAttribute('data-app-theme', previousAttribute);
    if (chrome && previousChrome !== undefined) chrome.content = previousChrome;
  };
}
