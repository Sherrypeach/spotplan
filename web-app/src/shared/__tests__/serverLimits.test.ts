import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as limits from '@shared/serverLimits';

const apiFile = (path: string) => fileURLToPath(new URL(`../../../../api/src/modules/${path}`, import.meta.url));
const apiFiles = [apiFile('classroom/utils/classroom-limits.ts'), apiFile('auth/utils/password-rules.ts')];

describe('server limits', () => {
  // Only where the API is checked out next to the web app, as on the team's server.
  it.skipIf(!apiFiles.every((file) => existsSync(file)))('match the API’s', () => {
    const api = Object.fromEntries(
      apiFiles.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/export const (\w+) = ([\d_.]+);/g)]).map(([, name, value]) => [name, Number(value.replace(/_/g, ''))]),
    );
    for (const [name, value] of Object.entries(limits)) expect(api[name], name).toBe(value);
  });
});
