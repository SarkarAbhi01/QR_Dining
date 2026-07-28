# 🍽️ QR-Based Contactless Dining System

A premium, multi-tenant (SaaS) contactless dining platform — customers scan a
table QR code, browse the digital menu, order, track it live, pay, and the
restaurant runs its kitchen, floor staff and billing off the same real-time
backbone.

**Stack:** React.js (Vite) · Node.js + Express · PostgreSQL + Prisma ORM · Socket.io

---

## 📁 Project Structure

```
qr-dining-system/
├── backend/                 # Node.js + Express + Prisma + Socket.io API
│   ├── prisma/
│   │   ├── schema.prisma    # Full multi-tenant database schema
│   │   └── seed.js          # Demo restaurant, staff, tables, menu
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.js       # JWT auth + role + tenant isolation
│   │   ├── sockets/index.js         # Real-time order/kitchen/waiter events
│   │   ├── controllers/             # auth, restaurant, table, menu, order
│   │   ├── routes/
│   │   ├── utils/qrGenerator.js     # Per-table QR code generation
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/                # React + Vite + Tailwind (custom design system)
    ├── src/
    │   ├── pages/
    │   │   ├── auth/Login.jsx
    │   │   ├── customer/MenuPage.jsx        # QR landing → menu → cart
    │   │   ├── customer/TrackOrderPage.jsx  # Live tracking, bill, split, call waiter
    │   │   ├── admin/                       # Dashboard, Menu, Tables, Staff, POS
    │   │   ├── kitchen/KitchenDisplay.jsx   # KDS
    │   │   ├── waiter/WaiterDashboard.jsx
    │   │   └── superadmin/SuperAdminDashboard.jsx
    │   ├── context/AuthContext.jsx
    │   ├── socket/socket.js
    │   └── api/axios.js
    ├── package.json
    └── .env.example
```

---

## 🔑 Roles Implemented

| Role | Access |
|---|---|
| **Super Admin** | Onboard restaurants, manage subscriptions, platform-wide analytics |
| **Restaurant Admin** | Menu, tables/QR, staff accounts, POS & billing, restaurant analytics |
| **Manager** | Same as Admin minus staff creation |
| **Chef** | Kitchen Display System (KDS) — accept → cook → ready |
| **Waiter** | Floor alerts, serve orders, offline POS billing |
| **Customer** | No login — QR scan → menu → order → live tracking → pay |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally or in the cloud (e.g. Supabase, Neon, Railway)

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env -> set DATABASE_URL to your PostgreSQL connection string

npx prisma migrate dev --name init   # creates all tables
npm run seed                          # loads demo restaurant + logins
npm run dev                           # starts API on http://localhost:5000
```

Demo logins created by the seed script:

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@qrdining.com | Password@123 |
| Restaurant Admin | admin@spicejunction.com | Password@123 |
| Chef | chef@spicejunction.com | Password@123 |
| Waiter | waiter@spicejunction.com | Password@123 |

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # defaults already point to localhost:5000
npm run dev             # starts on http://localhost:5173
```

### 4. Try the full workflow
1. Log in as **Restaurant Admin** → go to **Tables & QR** → open a table's QR code (or copy its menu URL).
2. Open that URL in another tab/phone — this is the **Customer** experience. Add items, place the order.
3. Log in as **Chef** (`/kitchen`) in another tab — the order appears instantly (Socket.io) — Accept → Cook → Ready.
4. Log in as **Waiter** (`/waiter`) — mark it **Served** once ready.
5. Back in the customer tab, watch the tracker update live: Placed → Accepted → Cooking → Ready → Served.
6. As **Admin/Manager**, go to **POS & Billing** → generate the bill → mark Cash/UPI paid → Complete & free the table.

---

## 🏗️ Architecture Highlights

- **Multi-tenancy:** every business record (`tables`, `menu_items`, `orders`, `users`, …) carries a `restaurantId`. The `enforceTenant` middleware blocks any staff member from touching another restaurant's data; only Super Admin bypasses it.
- **Real-time workflow:** Socket.io rooms (`restaurant:<id>`, `restaurant:<id>:kitchen`, `restaurant:<id>:waiter`, `order:<id>`) push every status change instantly to the right screens — no polling required.
- **QR flow:** each table has a unique, unguessable `qrToken` (UUID). Scanning resolves straight to that restaurant + table's live menu — no app, no login.
- **Order state machine:** transitions are validated server-side (`PENDING → ACCEPTED → COOKING → READY → SERVED → COMPLETED`), so no screen can skip or reverse a stage illegally.
- **Billing:** GST is computed per-restaurant (`gstPercent` on the tenant), discounts and bill-splitting are supported, and payments are logged in a dedicated `payments` table for reporting.
- **Premium features:** Call Waiter (Socket.io alert to floor staff), Bill Splitting (equal-split calculator), Best-Selling Dish & Top-Earning-Table analytics (Prisma `groupBy` aggregations).

---

## 🔌 Key API Endpoints

```
POST   /api/auth/login                          Staff login
POST   /api/auth/staff                           Create Manager/Chef/Waiter (Admin only)

POST   /api/restaurants                          Onboard restaurant (Super Admin)
GET    /api/restaurants/:id/dashboard            Restaurant analytics

GET    /api/tables/resolve/:qrToken              Public: QR → menu (no auth)
POST   /api/restaurants/:id/tables               Create table + QR

POST   /api/restaurants/:id/menu-items           Add dish
GET    /api/restaurants/:id/menu-items           Public: browse menu

POST   /api/public/orders                        Customer places order
GET    /api/public/orders/:id                    Customer polls order status
POST   /api/public/orders/:id/call-waiter         "Call Waiter" button
PATCH  /api/orders/:id/status                    Kitchen/Waiter advances order
POST   /api/orders/:id/bill                      Generate bill (GST + discount)
POST   /api/orders/:id/pay                       Mark paid (cash/UPI/online)
POST   /api/orders/:id/split                     Bill-splitting calculator
```

Full Socket.io events: `order:new`, `order:status`, `order:payment`, `waiter:call`.

---

## 🛠️ Production QR Fix + Change Password

**Why a QR scan can open the wrong page in production:** the QR image bakes in
`CLIENT_URL` from the backend's `.env` file at the moment the table was
created. If that was left as `http://localhost:5173` (or wasn't set) when you
deployed, every printed QR silently points to a URL only reachable from the
developer's own machine — that's almost always the cause.

Fixes now included:
- **`.env.example`** has an explicit warning + instructions to set `CLIENT_URL` to your real public domain before generating QR codes in production.
- **Tables & QR page** → every table now has:
  - **⬇ Download QR** — saves the QR as a PNG so it can be printed and placed on the table (works immediately, no design tool needed).
  - **Copy Menu Link** — copies the exact URL the QR encodes, for quick testing on your own phone.
  - **Fix domain & regenerate** — re-issues a table's QR against the correct URL (either the app's current URL, or a custom domain you type in) *without* deleting and recreating the table. Backend endpoint: `POST /api/tables/:id/regenerate-qr`.

**Change Password:** every staff role (Super Admin, Restaurant Admin, Manager,
Chef, Waiter) now has a **Change Password** link in their sidebar
(`/account/change-password`), backed by `PATCH /api/auth/change-password`
(verifies the current password before updating).

---

## 🧩 Extending This

- **Payment gateway:** wire Razorpay/PhonePe into `POST /api/orders/:id/pay` — the `gatewayRef` field on `Payment` is already there for the transaction ID.
- **Push notifications:** the `.env` has an `FCM_SERVER_KEY` slot ready for Firebase Cloud Messaging alerts to the Waiter/Chef mobile apps.
- **Thermal printing:** POS Billing screen is the natural place to hook in a `window.print()` receipt template or an ESC/POS printer SDK.

---

## 📜 License
This is a starter/reference implementation for your own commercial product — use and modify freely.
