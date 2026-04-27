import { Font } from '@react-pdf/renderer';

let registered = false;

/**
 * Registra fuentes Inter (latin) en `@react-pdf/renderer`. Idempotente y cacheada
 * a nivel módulo para no penalizar renders subsiguientes.
 *
 * Si querés bundlearlas, copialas a `public/fonts` y serví por path local.
 */
export function ensureFontsRegistered() {
  if (registered) return;
  Font.register({
    family: 'Inter',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa2pL7SUc.ttf',
        fontWeight: 700,
      },
    ],
  });
  // Disable hyphenation (default behavior breaks Spanish text awkwardly).
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
