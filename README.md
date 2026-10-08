# Personal Finance Tracker

A full-stack web app to **track daily income and expenses, manage monthly budgets, set and monitor savings goals**, and explore your finances with **interactive charts and reports**. Includes **secure authentication** and an **Admin Panel** that can manage users and website data.

**Stack:** Node.js · Express · Vanilla JS · Chart.js · HTML/CSS

> **No external database and no secrets to configure.** Data is stored in local JSON files (`./data`), and a random JWT signing secret is generated at startup — the app works out of the box.

## Features

- Track daily income and expenses with categories
- Create and manage monthly budgets per category (with live "used" progress)
- Set and monitor savings goals with contribution tracking
- Interactive charts: category breakdown, daily trends, monthly comparison, budget status
- Filter records by date range, type and category
- Export financial data to CSV
- Responsive, user-friendly dashboard
- Secure authentication: bcrypt password hashing + JWT tokens
- Admin Panel: platform stats, user management (view/edit/delete), and delete any transaction

## Admin account

An admin account is **created automatically on server start** (idempotent):

| Field    | Default                 |
| -------- | ----------------------- |
| Email    | `ratnasampath.5680@gmail.com` |
| Password | `Sampath@333`           |

Defaults can be overridden with `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` environment variables.

> Note: the default password is committed to this public repo for demo purposes. Change it via the Admin Panel or by setting `ADMIN_PASSWORD` before a real deployment.

## Storage & auth model

- **Data**: JSON files in `./data/` (`users.json`, `transactions.json`, `budgets.json`, `goals.json`). The directory is created automatically and is excluded from git.
- **Auth**: passwords are hashed with bcrypt; sessions use JWT signed with a secret that is **auto-generated at startup** unless `JWT_SECRET` is set. Without a fixed secret, users must log in again after a server restart.

## Project structure

```
├── server.js                 # Express server + static serving
├── db/store.js               # Lightweight JSON-file datastore (no MongoDB)
├── controllers/              # Business logic
├── routes/                   # /api/auth, /api/transactions, /api/budgets, /api/savings, /api/analytics, /api/admin
├── middleware/auth.js        # JWT protect + adminOnly (auto secret)
├── seed/seedAdmin.js         # Admin account seeding
└── public/                   # Frontend (HTML/CSS/JS)
```

## Local setup

Prerequisites: **Node.js 18+**. No database or other services needed.

```bash
npm install
npm start          # then open http://localhost:5000
```

Optional admin re-seed: `npm run seed:admin`.

## API overview

All routes below (except auth) require `Authorization: Bearer <token>`.

| Method | Route                        | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`         | Register user                        |
| POST   | `/api/auth/login`            | Login, returns JWT                   |
| GET    | `/api/auth/me`               | Current user                         |
| GET/POST | `/api/transactions`        | List / create transactions           |
| PUT/DELETE | `/api/transactions/:id`  | Update / delete transaction          |
| GET/POST | `/api/budgets`             | List (month/year) / create budget    |
| PUT/DELETE | `/api/budgets/:id`       | Update / delete budget               |
| GET/POST | `/api/savings`             | List / create savings goals          |
| POST   | `/api/savings/:id/contribute` | Add contribution to a goal        |
| GET    | `/api/analytics/summary`     | Monthly income/expense/balance       |
| GET    | `/api/analytics/categories`  | Spending by category                 |
| GET    | `/api/analytics/trend`       | Daily income/expense trend           |
| GET    | `/api/analytics/comparison`  | Last 6 months comparison             |
| GET    | `/api/analytics/export`      | Export data as JSON                  |
| GET    | `/api/admin/stats`           | Platform stats (admin only)          |
| GET    | `/api/admin/users`           | List users (admin only)              |
| GET/PUT/DELETE | `/api/admin/users/:id`  | View / edit / delete user (admin)    |
| DELETE | `/api/admin/transactions/:id` | Delete any transaction (admin)     |

---

# Deploying to Render

## 1. Push the project to GitHub

```bash
git add .
git commit -m "Personal Finance Tracker"
git push
```

> `.gitignore` already excludes `node_modules/`, `.env` and `data/` — never commit secrets.

## 2. Create a Web Service on Render

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repo (`24691A05LE/personal-finance-tracker`)
3. Fill in the form:

   | Field        | Value                      |
   | ------------ | -------------------------- |
   | Name         | `personal-finance-tracker` |
   | Environment  | `Node`                     |
   | Build Command | `npm install`             |
   | Start Command | `npm start`               |
   | Instance Type | Free                       |

4. Click **Create Web Service**. **No environment variables are required.**

> The admin account is seeded automatically — log in at `https://<your-app>.onrender.com/login` with `ratnasampath.5680@gmail.com` / `Sampath@333`.

## 3. Important caveats

- **Data persistence (free tier):** Render's free instance filesystem is ephemeral — JSON data in `./data` is wiped on every deploy/restart of the service. For real persistent storage, either
  - attach a **Persistent Disk** (paid Render plan) and set `DATA_DIR=/var/data`, or
  - switch to a hosted database (MongoDB Atlas or SQLite-compatible service) and point the data layer at it.
- **Sessions reset on restart:** without a fixed `JWT_SECRET`, tokens are invalidated when the service restarts (users re-login). Set `JWT_SECRET` if you want stable sessions across restarts.
- Free instances sleep after inactivity; the first request after a sleep takes ~30s to wake.

## Auto-deploy (optional)

Render auto-deploys on every push to the connected branch. A `render.yaml` blueprint is included for one-click setup.
