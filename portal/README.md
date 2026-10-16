# Promotion Requirements Portal (Preventive Medicine R1–R4)

A dependency-free web app (Node.js ≥ 20) for receiving and grading trainee requirements.

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

## Running
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
