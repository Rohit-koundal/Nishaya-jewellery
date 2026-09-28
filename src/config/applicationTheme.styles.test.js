import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
const tailwindConfig = require('../../tailwind.config');
const source = file => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

test('generated utilities support both shared themes and the original mobile RGB/opacity fallbacks', async () => {
  const markup = source('src/pages/customer/Home.jsx') + ' bg-wine/80 text-rose border-wine/20 font-display';
  const output = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: markup, extension: 'jsx' }] })])
    .process('@tailwind utilities;', { from: undefined });
  const declarations = [];
  output.root.walkDecls(decl => declarations.push(decl.value));
  expect(declarations.some(value => value.includes('var(--app-primary-rgb,157 49 84)'))).toBe(true);
  expect(declarations.some(value => value.includes('var(--app-secondary-rgb,255 249 245)/0.95'))).toBe(true);
  expect(declarations.some(value => value.includes('var(--app-primary-rgb, 109 31 52) / 0.8'))).toBe(true);
  expect(declarations.some(value => value.includes('var(--app-primary-rgb, 255 95 134)'))).toBe(true);
});

test('global appearance is opt-in and cannot change image cropping or grid geometry', () => {
  const tree = postcss.parse(source('src/styles/applicationTheme.css'));
  tree.walkRules(rule => expect(rule.selector).toContain('[data-app-theme="true"]'));
  tree.walkDecls(decl => expect(['object-fit', 'object-position', 'aspect-ratio', 'grid-template-columns', 'position', 'display']).not.toContain(decl.prop));
});

test('admin, mobile shopping and PWA controls consume shared tokens with their original defaults', () => {
  expect(source('src/components/admin/AdminShell.css')).toContain('--admin-wine: var(--app-primary, #6d1f34)');
  expect(source('src/styles/MobileShoppingTheme.css')).toContain('--shopping-action: var(--app-primary, #c73562)');
  expect(source('src/components/pwa/MobileAppCompanion.css')).toContain('var(--app-primary, #7b1834)');
  expect(source('src/components/admin/AdminShell.css')).toContain('.admin-btn-danger {');
  const danger = [];
  postcss.parse(source('src/components/admin/AdminShell.css')).walkRules(rule => {
    if (rule.selector === '.admin-btn-danger') rule.walkDecls(decl => danger.push(decl.value));
  });
  expect(danger).toContain('#bb3046');
  expect(danger.some(value => value.includes('--app-primary'))).toBe(false);
});
