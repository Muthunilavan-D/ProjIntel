# PROJINTEL

PROJINTEL is an academic project management platform for students, faculty guides, and department administrators. It provides project and milestone dashboards, proposal and review workflows, document handling, and AI-assisted academic project tools.

## Features

- **Student workspace:** project proposals and status, milestone and task tracking, weekly progress reporting, review schedules and submissions, document uploads, and an AI project assistant.
- **Faculty workspace:** proposal review, project oversight, review scheduling, deliverable review, official grading, weekly feedback, and document access.
- **Department administration:** project and faculty allocation, workload insights, project similarity checks, and department metrics.
- **AI services:** proposal and feasibility analysis, deterministic risk calculation and AI risk explanations, task prioritization, project summaries, weekly report analysis, feedback drafting, similarity and workload analysis, faculty recommendations, academic insights, chat assistance, and review evaluation.
- **Document and review APIs:** store document metadata in MongoDB, save uploaded files on the server, and manage defense-review submissions and evaluations.

### Current implementation notes

The frontend includes bundled demonstration projects and client-side login/role selection. It does not currently provide backend authentication or general project/student/faculty CRUD APIs. The Express API currently exposes health, AI, review, and document endpoints; review and document features require MongoDB. Some document/review upload flows can show an offline browser-only fallback, which is not persisted to MongoDB or the server.

## Technology

- **Frontend:** React 19, Vite 8, Bootstrap, Lucide React, CSS
- **Backend:** Node.js, Express 5, Mongoose, Multer
- **Database:** MongoDB (local or MongoDB Atlas)
- **AI:** Groq Cloud through the server-side Groq SDK

## Repository layout

```text
client/
  src/components/   React pages, dashboards, and modals
  src/services/     Frontend clients for AI, reviews, and documents
  package.json      Frontend scripts and dependencies
server/
  config/db.js      Mongoose connection
  models/           MongoDB/Mongoose models
  routes/           AI, review, and document API endpoints
  services/ai/      Groq-backed and deterministic AI services
  scripts/          Database seed and development checks
  uploads/          Locally stored uploaded files
  server.js         Express application entry point
  package.json      Backend scripts and dependencies
.env.example        Environment-variable template
README.md           Setup and project guide
```

## Requirements

- Node.js 20.19 or newer (or 22.12 or newer) and npm
- MongoDB running locally, or a MongoDB Atlas cluster
- A Groq API key for AI-powered features (optional for running the frontend/backend; AI requests need it)

## Install dependencies

Run these commands from the repository root. The frontend and backend have separate package manifests and lockfiles, so install each separately:

```powershell
cd server
npm ci
cd ..\client
npm ci
cd ..
```

Use `npm install` instead of `npm ci` only if you intend to change dependencies and regenerate a lockfile.

## Configure environment variables

Create a root-level `.env` from the example file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set the values below. Keep this file private: it contains credentials and is excluded from Git. Never put the Groq key in frontend source code or a `VITE_*` variable.

| Variable | Purpose | Required |
| --- | --- | --- |
| `PORT` | Port for the Express API. Defaults to `5000` if omitted. The frontend currently calls `http://localhost:5000` directly, so keep this at `5000` unless you also update the frontend API URLs. | No |
| `MONGO_URI` | MongoDB connection string used by the API and seed script. It also determines which database is selected. | Yes for database-backed API features |
| `DB_NAME` | Present in some existing local/example `.env` files, but **not currently read by the application**. To choose a database, include its name as the path in `MONGO_URI`, such as `/Final_Yr_Project`. | No; currently unused |
| `GROQ_API_KEY` | Secret API key used by the backend to authenticate requests to Groq. Without a valid key, AI-backed features are unavailable. | No for startup; yes for AI |
| `GROQ_MODEL` | Groq model name requested for AI completions. The example uses `llama-3.3-70b-versatile`; the backend fallback when unset is `openai/gpt-oss-120b`. Use a model available to your Groq account. | No |

The backend reads the root `.env` using the relative path `../.env`; start it from the `server` directory as shown below. The seed script resolves the root `.env` directly.

## Connect to MongoDB

### Option A: MongoDB Atlas

1. Create an Atlas cluster and a database user with a password.
2. In Atlas **Network Access**, allow the IP address of the machine running the backend. Avoid opening access to all IP addresses except for a temporary, controlled development setup.
3. Copy the cluster connection string and replace the username, password, and cluster host. Add the database name after the host:

   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/Final_Yr_Project?retryWrites=true&w=majority&appName=Cluster0
   ```

4. Put the finished value in the root `.env`. If the password contains reserved URL characters (for example `@`, `:`, `/`, or `#`), URL-encode them before using the connection string.

### Option B: Local MongoDB

Install and start the MongoDB Community Server, then use:

```env
MONGO_URI=mongodb://127.0.0.1:27017/Final_Yr_Project
```

Mongoose creates the database and collections when the application writes data. You do not need to pre-create the database. Check that the database name is in the URI path: setting `DB_NAME` alone does not change the selected database.

## Run the application

Open two terminals in the repository root.

**Terminal 1 — backend API:**

```powershell
cd server
npm start
```

The server listens on `http://localhost:5000` by default. Confirm it is running at `http://localhost:5000/api/health`. MongoDB connection errors are printed in this terminal.

**Terminal 2 — frontend:**

```powershell
cd client
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The frontend's current service modules call the backend at `http://localhost:5000`; start the backend on that port for API-backed features.

**Production frontend build:**

```powershell
cd client
npm run build
npm run preview
```

## Optional: seed demo data

From the repository root:

```powershell
cd server
node scripts/seed.js
```

**Warning:** this script deletes existing records from the application's collections (and attempts to drop a legacy `users` collection) before inserting demo data. Run it only against a disposable development database. Verify `MONGO_URI` carefully and back up any data you need before running it; do not run it against a production or shared database. The script includes demo passwords and resets data to its bundled sample set.

The seed script has a built-in fallback connection string if `MONGO_URI` is not set. Always create/configure the root `.env` and verify the target database before running the script; do not rely on the fallback.

Demo login values (the frontend login is client-side demonstration behavior; it does not authenticate through a backend API):

| Role | Email | Password |
| --- | --- | --- |
| System Admin | `admin@vcet.edu.in` | `admin123` |
| Faculty Guide (HOD) | `guide@vcet.edu.in` | `password123` |
| Faculty Guide | `sharma@vcet.edu.in` | `password123` |
| Student Lead | `student@vcet.edu.in` | `password123` |
| Student (IoT) | `anand@vcet.edu.in` | `password123` |
| Student (Vision) | `rohan@vcet.edu.in` | `password123` |
| Student (Blockchain) | `meena@vcet.edu.in` | `password123` |

## API overview

- `GET /api/health` — backend health
- `/api/ai` — AI health and project/academic AI operations
- `/api/reviews` — retrieve and schedule reviews, submit/upload deliverables, and record evaluations
- `/api/documents` — upload, retrieve, and delete project documents
- `/uploads/...` — serve uploaded document and review files

Uploaded files are stored on the backend filesystem under `server/uploads/`; MongoDB stores their metadata. Back up the database and this folder together if you need to preserve uploaded content.

## Troubleshooting

- **MongoDB connection fails:** confirm the MongoDB service is running, the URI is valid, the database name is in the URI path, and (for Atlas) the current IP is allowed and the database credentials are correct.
- **Backend reports a missing `.env`:** create `.env` in the repository root and start the backend from `server/` (`cd server; npm start`).
- **AI endpoints report the service is unconfigured:** set a valid `GROQ_API_KEY` in the root `.env`, then restart the backend. Check `http://localhost:5000/api/ai/health`.
- **Frontend cannot reach API-backed features:** ensure the backend is running on port `5000`. The frontend currently uses fixed `http://localhost:5000` service URLs.
- **Port is already in use:** stop the other process using the port or change the backend port and update the frontend service URLs to match.

## License

This project is licensed under the ISC License.
