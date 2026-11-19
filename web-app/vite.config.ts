/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import { appHeaders, BASIC_HEADERS } from './security-headers';
import { apiProxy } from './vite.proxy';


const DEFAULT_API_URL = 'http://localhost:3000';

// Path aliases come from tsconfig.app.json via vite-tsconfig-paths — single
// source of truth, no manual resolve.alias duplication.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Production serves the same /api proxy from its web server.
  const proxy = apiProxy(env.API_URL || DEFAULT_API_URL);

  return {
    plugins: [react(), tsconfigPaths(), tailwindcss()],
    server: {
      proxy,
      headers: BASIC_HEADERS,
    },
    // `vite preview` serves the built app the way production should.
    preview: { proxy, headers: appHeaders() },
    build: {
      rollupOptions: {
        output: {
          // Libraries that rarely change get their own files, so browsers keep them cached
          // across releases. A function, so their internal modules land there too.
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
            if (/node_modules\/(@apollo|graphql|@wry|optimism|zen-observable|ts-invariant)/.test(id)) return 'apollo';
            return undefined;
          },
        },
      },
    },
    test: {
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
