# SpotPlan — web app

React 19 SPA over the seating GraphQL API. Apollo Client used idiomatically — provider + hooks + normalized cache — with operations typed end-to-end by GraphQL Codegen. Stack specifics live here.

## Stack

React 19 · Vite 7 · TypeScript strict · Apollo Client 3 · GraphQL Codegen (client preset) · Tailwind 4 · react-router-dom 7 · Tabler icons · Poppins (self-hosted via @fontsource).

**Styling:** Tailwind only, with the indigo and sunflower palette defined once as theme tokens in `src/index.css` (`bg-sage-soft`, `bg-action`, `bg-level-1`…); only the logo block uses the brand green. A dark theme redefines the same tokens under `[data-theme='dark']` (screens only; printing stays light). `index.html` sets the theme before the first paint; `ThemeProvider` keeps it in step with the teacher's choice (`seating.theme` in localStorage, synced across tabs) or the device setting. No component library: the few building blocks (`Button`, `TextField`, `TextArea`, `Modal`, `TipBox`…) live in `src/components/` and follow the "big, simple, one obvious next step" rule.

## Layout

```
src/
├── components/    Shared, domain-agnostic building blocks (Button, TextField…)
├── assets/brand/  Logo
├── config/        apollo.client.ts (same-origin /api, client header)
├── context/       AuthProvider.tsx (session state) and auth.ts (useAuth)
├── graphql/
│   ├── generated/ Codegen output — committed, never hand-edited
│   └── operations/ Typed documents via the generated graphql() tag
├── modules/       One folder per feature: auth, shell, steps, classroom (the class
│                  document, edits, roster import, autosave), students (step 1),
│                  seating/engine (the seating engine), layouts (the layout library)
└── shared/        Hooks and helpers that aren't components

vite.proxy.ts      The dev /api proxy (and the X-Forwarded-For rule)
```

Path aliases (`@components`, `@config`, `@context`, `@graphql`, `@modules`, `@shared`, `@assets`, `@test`) are defined **once** in `tsconfig.app.json`; `vite-tsconfig-paths` reads them.

## GraphQL workflow

1. `schema.graphql` is a committed snapshot of the API schema — refresh it from the api repo when the API changes.
2. Write operations with the typed tag: `graphql(\`query Me { ... }\`)` in `src/graphql/operations/`.
3. `npm run codegen` (or `codegen:watch` while developing). Hooks (`useQuery`/`useMutation`) infer result + variable types from the document.

## Auth model

The API keeps the session in an httpOnly cookie (`seating_session`); scripts never see a token. The browser reaches the API only through this app's same-origin `/api` proxy (Vite's dev proxy locally, the web server in production), which is what lets the cookie travel. Every request carries the `x-seating-client` header the API requires for writes. On load, `AuthProvider` asks `me` whether a session exists. If the API doesn't answer, the app says it can't connect instead of showing the sign-in form. The session is re-checked when the teacher comes back to the tab, and any `UNAUTHENTICATED` from a signed-in request sends them to sign in with a note, returning them to the page they were on. Sign out only clears the app once the API confirms it. There is no public sign-up: teachers are created on the API (`npm run teacher:create`).

Routes: `/auth/login`; `/auth/reset` (email → 6-digit code → new password; the API's reset email links here; `/auth/forgot` redirects to it); the four steps from `src/modules/steps/steps.ts` inside `AppShell`. Step 1's parts are `/students?part=names|support|anywhere|check|extras`; a later step can send the teacher there with `state.returnTo`, and the check and last parts offer the way back.

The API limits sign-in tries per browser address and trusts `X-Forwarded-For` only from this machine. The dev proxy (`vite.proxy.ts`) replaces that header with the real peer address unless the request came through the local tunnel.

The session cookie is marked Secure outside `NODE_ENV=local`, so over plain http (e.g. the server's IP on port 5000) sign-in seems to work and then doesn't stick. Test through the https tunnel, or run the API with `NODE_ENV=local` on a machine only you can reach.

## The class document

Each class is one JSON document on the API (`modules/classroom/document.ts`). `ClassroomProvider` loads the open class (the last one used on this device, `seating.lastClass`), and every edit is a pure function in `rosterEdits.ts` that returns a new document. `useAutosave` saves 800 ms after the last change, one save at a time, on top of the last revision the server confirmed. A newer revision elsewhere (`CONFLICT`) or a document the server refuses stops saving until the class is loaded again; switching class or signing out saves first and asks before dropping unsaved changes. The limits in `rosterEdits.ts` mirror the API's validator, so a save is never refused for size.

**Roster import** (`rosterImport.ts`, `roster/`): pasted text, CSV/TSV (any common encoding, including Excel's UTF-16 and Windows-1252) and `.xlsx` (via `read-excel-file`, loaded only when used). It reads levels before, after or inside names, "Last, First", numbered and bulleted lists, emails, ID numbers, headings and header rows. File rows land in the names notebook so the teacher can check them before adding.

**Private info:** "Private info hidden" (remembered on the device as `seating.privateHidden`) removes levels, needs and notes from every screen, covers step 1 completely, and keeps the names being typed.

## Run it

```bash
cp .env.example .env    # API_URL → where /api is proxied (the api's port)
npm ci
npm run dev             # accepts -- --port <n> --host (how the platform's PM2 runs it)
```

- **Build:** `npm run build` → static SPA in `dist/`. Serve it with SPA fallback and proxy `/api/*` to the API (stripping the `/api` prefix) on the same origin and the same machine, setting `X-Forwarded-For` to the browser's address. No SSR.
