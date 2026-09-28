import React from 'react';
import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import ApplicationThemeProvider from './ApplicationThemeProvider';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';

let mockConfig;
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: () => ({ config: mockConfig }) }));
jest.mock('@mantine/core', () => ({ MantineProvider: ({ children, theme }) => <div data-testid="component-theme" data-primary={theme.colors.maroon[theme.primaryShade]}>{children}</div> }));

function Screens() { return <><header>Admin</header><main>Store</main>{createPortal(<dialog open>Quick view</dialog>, document.body)}</>; }
beforeEach(() => { mockConfig = mergeWebsiteConfig(); });

test('published theme updates flow to every screen without remounting content; Default removes overrides', () => {
  const { rerender, unmount } = render(<ApplicationThemeProvider><Screens /></ApplicationThemeProvider>);
  const admin = screen.getByText('Admin'); const dialog = screen.getByRole('dialog');
  expect(document.documentElement.getAttribute('data-app-theme')).toBe('false');
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('');
  mockConfig = mergeWebsiteConfig({ theme: { preset: 'indigo', enhancedStyles: true }, colors: { primary: '#333b70' } });
  rerender(<ApplicationThemeProvider><Screens /></ApplicationThemeProvider>);
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('#333b70');
  expect(screen.getByTestId('component-theme').getAttribute('data-primary')).toBe('#333b70');
  expect(screen.getByText('Admin')).toBe(admin);
  expect(screen.getByRole('dialog')).toBe(dialog);
  mockConfig = mergeWebsiteConfig();
  rerender(<ApplicationThemeProvider><Screens /></ApplicationThemeProvider>);
  expect(document.documentElement.style.getPropertyValue('--app-primary')).toBe('');
  expect(document.documentElement.getAttribute('data-app-theme')).toBe('false');
  unmount();
  expect(document.documentElement.hasAttribute('data-app-theme')).toBe(false);
});
