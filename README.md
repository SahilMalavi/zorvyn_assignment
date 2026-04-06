# Finance Dashboard API

A backend for a finance dashboard system with role-based access control, built with Node.js, Express, and MongoDB.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js + Express** | Straightforward, widely used web framework |
| **MongoDB** | Flexible document store, good fit for financial records with varying fields |
| **JWT** | Stateless auth, no session storage needed |
| **bcryptjs** | Password hashing |

---

## Setup

```bash
npm install
```

Make sure MongoDB is running locally (default: `mongodb://localhost:27017`), or set `MONGO_URI` in a `.env` file.

```bash
cp .env.example .env
npm start
```

### Default Admin Account

On first start, a default admin is seeded automatically:

```
Email:    admin@finance.com
Password: admin123
```

---

## Roles & Permissions

| Role | Permissions |
|---|---|
| `viewer` | Read transactions, view basic dashboard summary |
| `analyst` | Everything viewer can do + create transactions + access detailed analytics |
| `admin` | Full access — manage users, all transaction operations, all dashboard routes |

---

## API Reference

All protected routes require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register as viewer |
| `POST` | `/api/auth/login` | Public | Login, returns JWT |
| `GET` | `/api/auth/me` | Any auth | Get current user info |

**Login example:**

```json
POST /api/auth/login
{
  "email": "admin@finance.com",
  "password": "admin123"
}
```

---

### Users *(Admin only)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create user with any role |
| `PATCH` | `/api/users/:id` | Update role or status |
| `DELETE` | `/api/users/:id` | Delete user |

**Create user:**

```json
POST /api/users
{
  "name": "Sahil Malavi",
  "email": "sahil@example.com",
  "password": "pass123",
  "role": "analyst"
}
```

---

### Transactions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | Any auth | List with optional filters + pagination |
| `GET` | `/api/transactions/:id` | Any auth | Single transaction |
| `POST` | `/api/transactions` | analyst, admin | Create |
| `PUT` | `/api/transactions/:id` | admin | Update |
| `DELETE` | `/api/transactions/:id` | admin | Soft delete |

**Query filters for `GET /api/transactions`:**

```
?type=income
?type=expense
?category=food
?from=2024-01-01
?to=2024-12-31
?page=1&limit=20
```

**Create transaction:**

```json
POST /api/transactions
{
  "amount": 50000,
  "type": "income",
  "category": "Salary",
  "date": "2024-03-01",
  "notes": "March salary"
}
```

---

### Dashboard

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Any auth | Total income, expenses, net balance |
| `GET` | `/api/dashboard/by-category` | analyst, admin | Totals grouped by category |
| `GET` | `/api/dashboard/monthly-trends` | analyst, admin | Month-over-month breakdown |
| `GET` | `/api/dashboard/recent` | Any auth | Recent transactions |

```
GET /api/dashboard/monthly-trends?months=6
GET /api/dashboard/recent?limit=5
```

---

## Postman API Testing Guide

Follow these steps to quickly test the core flows of the application using Postman.

### Step 1: Login & Get Token

The database seeds an admin user on startup. Use it to test protected routes.

- **Method:** `POST`
- **URL:** `http://localhost:3000/api/auth/login`
- **Body (JSON):**

```json
{
  "email": "admin@finance.com",
  "password": "admin123"
}
```

> **Action:** Copy the `token` string from the response.

---

### Step 2: Configure Authorization

For all steps below, attach your token:

1. In Postman, go to the **Auth** tab of your request.
2. Select **Bearer Token** from the dropdown.
3. Paste your token into the **Token** field.

---

### Step 3: Create Transactions

Add some data for the dashboard to aggregate.

- **Method:** `POST`
- **URL:** `http://localhost:3000/api/transactions`
- **Body (JSON):**

```json
{
  "amount": 5000,
  "type": "income",
  "category": "Salary",
  "date": "2024-04-01",
  "notes": "Monthly payroll"
}
```

> **Tip:** Send this request a few times, changing `amount`, `type` (make one an `"expense"`), and `category` to populate the database.

---

### Step 4: Check Dashboard Aggregation

Verify that the MongoDB aggregation pipelines are correctly calculating totals.

- **Method:** `GET`
- **URL:** `http://localhost:3000/api/dashboard/summary`
- **Expected Result:** Total income, total expenses, and the correctly calculated net balance.

---

### Step 5: Test Soft Delete Logic

Verify that records are marked as deleted but retained in the database, and no longer affect dashboard totals.

- **Method:** `DELETE`
- **URL:** `http://localhost:3000/api/transactions/<TRANSACTION_ID>`

> **Action:** After deleting, run Step 4 again. The totals should decrease, proving the `$match: { is_deleted: false }` aggregation works.

---

### Step 6: Test Role Constraints

Verify access control:

1. Register a new user via `POST /api/auth/register` — they default to the `viewer` role.
2. Login with that user and copy their token.
3. Try to create a transaction using their token.

> **Expected Result:** A `403 Forbidden` error, because Viewers cannot modify data.

---

## Project Structure

```
src/
  index.js              # App setup, MongoDB connect, server start
  db/
    database.js         # MongoDB connection, indexes, seed
  middleware/
    authMiddleware.js   # JWT verification + role-level guard
  routes/
    auth.js             # Login, register, /me
    users.js            # User management (admin)
    transactions.js     # Financial records CRUD + filters
    dashboard.js        # Summary and analytics (aggregation pipelines)
```

---

## Design Decisions & Assumptions

- **Self-registration always creates viewers** — admins create `analyst`/`admin` accounts via `/api/users`.
- **Soft deletes on transactions** — records are never hard deleted (`is_deleted: true`). Keeps an audit trail.
- **Analysts can create but not edit/delete** — stricter control over modifications felt right for a finance system.
- **Dates stored as `YYYY-MM-DD` strings** — simple, sortable, and consistent.
- **No refresh tokens** — JWT is valid for 24 hours. Fine for this scope.