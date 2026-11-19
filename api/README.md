# SpotPlan — API

SpotPlan's GraphQL API: manager accounts and cookie sessions, and each manager's teams (one versioned JSON document per team). NestJS, schema-first GraphQL with a little REST, TypeORM + Postgres, roles/permissions, migrations + seeders.

## Stack

NestJS 12 · Apollo Server 5 (schema-first) · TypeORM 0.3 + Postgres · Passport JWT · class-validator · Jest.

## Layout

```
src/
├── core/             Shared toolbox: guards, decorators, dto, enums, models, abstracts
├── infrastructure/   Config (+Joi validation), database (+migrations/seeds), graphql typings, email
└── modules/          One folder per domain: auth, user, role, classroom
```

Path aliases: `@app/*`, `@core/*`, `@infrastructure/*`, `@modules/*` — use them, not relative paths.

Each module follows the guideline layout: `<name>.module.ts`, `<name>.graphql`, `<name>.repository.ts` at the root; `resolvers/`, `controllers/`, `services/`, `dto/`, `entities/` folders; colocated `*.spec.ts`.

## API paradigm

- **GraphQL is the primary surface** (`/graphql`): auth, users, roles, and classes (`myClassrooms`, `classroom`, `createClassroom`, `saveClassroom`, `removeClassroom`). Requests are refused when nested too deep or asking for too many fields (`core/graphql/query-limits.ts`), and bodies nested absurdly deep never reach it (`core/middlewares/json-depth.middleware.ts`). Schema-first — each module owns a `.graphql` file; run `npm run generate-typings` after editing one. Never edit `src/infrastructure/graphql/graphql.schema.ts` by hand.
- **REST**, when a module needs it: a controller in `controllers/` guarded with `AuthGuard('custom-jwt')` + `PermissionsGuard`, delegating to the module's existing service. Swagger lists it at `/api/docs` outside production.
- `GET /health` is public, for uptime checks.

## Auth model

`login` sets the session in an httpOnly cookie (`seating_session`, Secure outside `NODE_ENV=local`) and returns the user; scripts never see a token. Writes must carry the `x-seating-client` header (the web app's proxy sends it). `logout` ends only this device's session: its id goes into the `ended_sessions` table until the token would have expired anyway (expired rows are pruned on the next sign-out), so other devices stay signed in. Password reset: `forgotPassword` (answers at once; emails a hashed, expiring 6-digit code in the background, with its own rate limit) → `validateOtp` (5 tries, and the code lasts `OTP_TTL_MINUTES`, 15 by default; returns a reset token that lasts `RESET_TOKEN_TTL_MINUTES`, 10 by default) → `resetPassword` (at least 8 characters, at most 72 bytes; rules in `modules/auth/utils/password-rules.ts`). Session and reset tokens are signed with separate keys derived from `JWT_SECRET` (`modules/auth/utils/tokens.ts`). Emails are stored and looked up trimmed and in lower case. Every resolver/endpoint is guarded (`core/guards/resolver-guards.spec.ts` fails if one loses its guards) and carries `@RequirePermission(PermissionEnum.X)`; permissions are seeded, role grants live in `run-seeds.ts`. There is no public sign-up: `npm run teacher:create`.

## Run it

```bash
cp .env.example .env       # fill JWT secrets + database
npm ci
npm run migration:run      # schema — synchronize is OFF, always migrations
npm run seed               # permissions, roles, admin user (SEED_ADMIN_*)
npm run teacher:create -- ana@company.com Ana Rossi   # a teacher account; prints a first password
npm run start:dev          # listens on PORT (falls back to APP_PORT, then 3000)
```

No local Postgres? `docker compose -f docker-compose.dev.yml up -d` starts a disposable one matching `.env.example`.

`NODE_ENV` is required (dev, staging, prod or local). Saving a class is checked against its revision in one statement; the same save sent again after a lost answer is accepted rather than reported as a conflict.

## Adding a module (checklist)

entity extending `BaseModel` → migration → `.graphql` + `npm run generate-typings` → DTOs with class-validator decorators → repository extending `TypeOrmRepository<T>` → service → guarded resolver/controller → wire the module → colocated specs → `npm run lint && npm run test`.

New permissions go in `PermissionEnum` **and** the seeder — an endpoint without a seeded permission is a bug.

## Definition of done

`npm run lint` · `npm run test` · typings regenerated if a `.graphql` changed · migration exists if an entity changed.

## Deploy

- **Container (Render, Fly, etc.)**: the `Dockerfile` builds the production image (`node dist/main`). Migrations run from the compiled code there: `npm run migration:run:prod` (no ts-node needed). Set `DATABASE_SSL_CA` to the provider's CA certificate so the database's certificate is checked.
- **Dependencies:** NestJS 12 (`@nestjs/graphql`/`apollo` 14, `swagger` 12), pinned to exact versions; `overrides` in `package.json` hold back packages published less than two weeks ago. `@nestjs/cli` and `schematics` stay on 11 (version 12 needs TypeScript 6). NestJS 12 ships as ES modules: the app (CommonJS) loads them through Node 22's `require(esm)`, and Jest converts them with `jest.esm-transform.js`.
