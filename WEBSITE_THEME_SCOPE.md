# Website theme scope

- **Default:** retains the original mobile palette, fonts and responsive composition. Editing content/branding alone does not opt the mobile site into a new appearance.
- **Published appearance:** named presets (including Indigo), or custom appearance settings, share their palette and fonts across desktop, tablet, mobile, admin, seller pages and body-portalled dialogs. The component-library palette and browser theme color update too.
- **Device layout stays independent:** product columns, image fit/crop, navigation, section ordering, content and commerce behavior are not replaced by a preset. Mobile color overrides are coordinated when applying a preset; subsequent explicit Mobile-tab overrides still take precedence.
- **Drafts stay private:** the preview iframe uses its own document tokens. Saving a draft does not recolor the live admin/store; publishing refreshes the active configuration. Default/undo restores the prior appearance without leaving CSS variables behind.

The shared contract is `src/config/applicationTheme.js`, applied by `ApplicationThemeProvider`. Tailwind brand utilities and migrated CSS/UI colors use these tokens with their original colors as fallbacks. Keep semantic error/warning/success colors and actual product-image/swatches independent of branding.

## Deployment and checks

Frontend deployment only; no database migration or new environment variable is required. Existing published themes use the shared appearance on the new frontend. For a new look, use Website Designer → Presets → review the device previews → publish.

Check Default and Indigo at phone, tablet and desktop sizes, plus admin navigation/forms and a dialog. Verify theme switching does not change product cropping, cart/checkout state or mobile columns. Return to Default to verify the original mobile look. Browser visual verification still needs a connected browser/device; automated tests cover tokens, compiled CSS, preset application, lifecycle cleanup and existing commerce flows.
