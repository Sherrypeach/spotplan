import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Component tests opt into a browser-like DOM with `// @vitest-environment jsdom`;
// the rest (the engine) runs in plain Node. Globals are off, so unmount here.
afterEach(cleanup);
