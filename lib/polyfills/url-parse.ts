/**
 * pdfjs-dist (react-pdf) calls URL.parse, which older browsers lack (Chrome <126, older Edge).
 * Install a minimal polyfill before any PDF library code runs.
 */
export function installUrlParsePolyfill(): void {
  if (typeof URL === 'undefined') return;
  if (typeof URL.parse === 'function') return;

  URL.parse = function parse(url: string, base?: string | URL): URL | null {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}

installUrlParsePolyfill();
