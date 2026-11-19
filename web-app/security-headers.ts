import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The one inline script (the theme picker in index.html) is allowed by its hash,
// worked out from the file so editing it can't silently break the page.
function inlineScriptHashes(): string[] {
  const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

/** Safe on any server, including the dev server behind the platform's tunnel. */
export const BASIC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

/**
 * What the built app should be served with: no framing (no clickjacking on
 * "Delete class"), and scripts, fonts and requests only from this site.
 */
export function appHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes().join(' ')}`,
    // React sets style attributes (drag positions, sizes).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return { ...BASIC_HEADERS, 'Content-Security-Policy': csp, 'X-Frame-Options': 'DENY' };
}
