# Promotion Requirements Portal (Preventive Medicine R1–R4)

A web app with no runtime dependencies that runs on Cloudflare Workers (free) or any Node.js ≥ 20 server. for receiving and grading trainee requirements.

## Flow
1. **Registration:** the trainee registers (name, email, mobile, SCFHS number, level, center) → account is *awaiting activation*.
2. **Activation:** the administration reviews, activates or disables the account, and sets the level.
3. **Requirements:** trainees see only their level's requirements. Each has:
   - a submission window (open/close, Riyadh time) plus a late period (14 days by default) and a countdown;
   - instructions, required file type and size, how to submit, references;
   - a 100-point rubric: content criteria (90) + timeliness (10, computed automatically).
4. **Upload:** only inside the window, with file type and size checks; replaceable until closing or grading.
5. **Grading:** the admin downloads the file and rates each criterion (Excellent 100% · Adequate 70% · Weak 40% · Absent 0%); the trainee sees the score and feedback.

Public pages: user guide, external registration sites (SCFHS, CDC TRAIN, OpenWHO, NCBE, PROSPERO…), references to download.

The 91 requirements are pre-filled from the promotion handbook, dated for the training year starting in October of `YEAR_START`.

Screenshots: `docs/screenshots/`.

## Free hosting on Cloudflare (recommended)
Free plan, no credit card. Data is stored in **D1** (Cloudflare's SQLite database) and uploaded files in **Workers KV** (up to 25 MB per file). Every push to GitHub redeploys automatically.

One-time setup:
1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. **Workers & Pages → Create → Import a repository**, connect GitHub and pick this repository.
3. In the build settings set **Root directory** to `portal` (the deploy command stays `npx wrangler deploy`). Choose the branch to deploy.
4. Deploy. The D1 database and KV namespace are created automatically on the first deploy.
5. Open the Worker → **Settings → Variables and Secrets** and add two **secrets**: `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Until they are set, the API answers with a message asking for them.
6. Open the link (`https://promotion-portal.<your-account>.workers.dev`) and sign in with those credentials.

Changing `ADMIN_PASSWORD` later resets the admin password. Free plan limits that matter here: 100,000 requests/day, D1 5 GB, KV 1 GB of files and 1,000 uploads/day.

Backups: D1 keeps 30 days of point-in-time history (**Time Travel**). To export: `npx wrangler d1 export promotion-portal --remote --output backup.sql`.

## Running on your own server
```bash
cd portal
ADMIN_EMAIL=admin@center.sa ADMIN_PASSWORD='strong-password' npm start   # http://localhost:3100
npm test
```
| Variable | Default |
|---|---|
| `PORT` | 3100 |
| `DATA_DIR` | `portal/data` (JSON database + uploads folder — back it up) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin account created on first run; if no password is set, one is printed to the log |
| `YEAR_START` | 2026 |

Put it behind HTTPS (e.g. Caddy or Nginx) when deploying.

## Structure
```
lib/core.js          all portal logic (shared by both platforms)
lib/catalog.js       the R1–R4 requirements from the promotion handbook
lib/file-store.js    storage for Node: db.json + uploads/
server.js            Node server
cloudflare/worker.js Cloudflare Worker: D1 for data, KV for files
public/              the interface (served as static assets on Cloudflare)
```
Local Cloudflare test: put `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `portal/.dev.vars`, then `npm install && npm run cf:dev`.
