# SpotPlan

Office seating planner: add your team, draw the office, pick a desk layout, and SpotPlan seats everyone by how much support they need, who should sit apart, and who needs a quiet spot or to be near the door. Then print or share the seating chart for moving day.

- `web-app/` — React 19, TypeScript, Vite, Apollo Client, Tailwind 4
- `api/` — NestJS, GraphQL (Apollo), TypeORM + PostgreSQL, cookie sessions

Each folder has its own README with setup steps.

Built by Cassandra Perche.

## Live demo setup (Render + Neon)

1. Create a free Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. On [Render](https://render.com), choose **New → Blueprint** and pick this repo (it reads `render.yaml`).
3. Fill in `DATABASE_URL` (the Neon string), `WEB_APP_URL` (the Render URL, e.g. `https://spotplan.onrender.com`) and `DEMO_PASSWORD`.

On every start the server runs the migrations, the seeds and makes sure the demo account exists. The free plan sleeps after 15 minutes without visits, so the first load can take about a minute.
