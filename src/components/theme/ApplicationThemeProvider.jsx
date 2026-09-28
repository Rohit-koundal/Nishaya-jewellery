import { useLayoutEffect, useMemo } from 'react';
import { MantineProvider } from '@mantine/core';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { applyDocumentTheme, buildApplicationTheme } from '../../config/applicationTheme';
import '../../styles/applicationTheme.css';

export default function ApplicationThemeProvider({ children }) {
  const { config } = useWebsiteCustomization();
  const appearance = useMemo(() => buildApplicationTheme(config), [config]);
  useLayoutEffect(() => applyDocumentTheme(appearance), [appearance]);
  return <MantineProvider theme={appearance.componentTheme}>{children}</MantineProvider>;
}
