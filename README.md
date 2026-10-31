# Order Flow – Inventory & Order Management

**Live demo:** <https://order-flow-scm.vercel.app>

A single-codebase React + Vite app for managing products, inventory, customers,
orders, fulfillment, stock reconciliation and users. It runs entirely in the browser:
no backend server, no database and no environment variables.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build` (production build to `dist/`), `npm run preview`.

> **Note:** Vite can't work from a folder path that contains `#`, for example
> `# Project For SCM MERN`. Both `dev` and `build` fail with module-resolution errors.
> Move or rename the folder so its path has no `#` before you run the app.

### Demo accounts

All demo accounts use the password `password123`. The login page opens on four role cards. Pick one
to get a sign-in form already filled with that role's demo email and password, which are also shown
below the form with copy buttons. Choosing a card only fills in the form: you still sign in the
normal way, and a wrong password is still rejected.

| Role      | Email                   | Access                                            |
|-----------|-------------------------|---------------------------------------------------|
| admin     | admin@orderflow.com     | Everything, including users, approvals and data reset |
| sales     | sales@orderflow.com     | Customers and orders                              |
| warehouse | warehouse@orderflow.com | Inventory adjustments, fulfillment, reconciliation |
| viewer    | viewer@orderflow.com    | Read-only                                         |

New self-registered accounts get the `viewer` role.

## How data is stored

- On the **first visit**, the app loads sample data (12 products, 6 customers, 8 orders,
  2 reconciliations and the stock movement history) into `localStorage`.
- Every change you make (create, edit, delete, confirm, ship and so on) is saved in the browser
  straight away. It's still there after a refresh or when you reopen the browser.
- The sample data **never** overwrites saved data. It only comes back when you ask for it with
  **Reset Data** (header, admin only) or **Reset to sample data** (login page).
- Each request works on a fresh snapshot and saves only if it succeeds. A failed operation, such
  as confirming an order without enough stock, leaves nothing half-applied.
- Bad saved data is handled when the app loads:
  - **Invalid records** are dropped and the valid ones are kept.
  - **Unreadable data** is backed up under `orderflow:db:corrupt-backup` and then replaced with the sample data.
  - If **no admin is left**, the demo accounts are restored.
  - If **storage is blocked** (for example in some private-browsing modes), the app runs in memory.

  In every case the app shows a warning.

| localStorage key            | Contents                                   |
|-----------------------------|--------------------------------------------|
| `orderflow:db`              | All collections plus metadata (versioned)  |
| `orderflow:token`           | Current session token                      |
| `orderflow:db:corrupt-backup` | Unreadable data, kept if it's ever found |

Passwords are salted and hashed (SHA-256) before they're stored. This is only a local demo:
anyone who can use the browser profile can read or change the stored data.

## Installing as an app (PWA)

The production build is an installable Progressive Web App. It has a web manifest, icons
(including a maskable icon) and a service worker in `public/sw.js`. The service worker caches the
app shell, so the app still opens offline, and your data is in `localStorage` anyway. In
Chrome or Edge, use the install icon in the address bar. On iOS Safari, use Share → Add to Home Screen.
The service worker is registered only in production builds (`npm run build` / the deployed site).

## Deployment (Vercel)

`vercel.json` sets the Vite framework preset, the build command (`npm run build`) and the output
folder (`dist`). It also adds a fallback rewrite so routes like `/orders` work on a refresh or as a
direct link, and sets cache headers for `sw.js` and the hashed assets. No environment variables
are needed.

## Project structure

```
src/
  data/                 Browser data layer
    db.js               localStorage store: load, validate, repair, save, reset
    seed.js             Sample dataset + demo accounts
    crypto.js           IDs, tokens, password hashing
    ApiError.js         Error type (axios-compatible shape)
  services/
    api.js              Local API: route table, auth/role checks, request queue
    handlers/           One module per resource (business rules, validation)
  context/AuthContext.jsx
  components/           Layout, Sidebar, Header, Pagination, ErrorBoundary
  pages/                Dashboard, Products, Inventory, Customers, Orders,
                        OrderDetail, Fulfillment, Reconciliation, StockMovements,
                        Users, Login, Register
public/                 PWA manifest, service worker, icons, login background
                        (port photo by Ruchindra Gunasekara on Unsplash, Unsplash License)
vercel.json             Vercel build + routing config
```

Pages call `API.get/post/put/delete("/orders", ...)` the same way they called the old REST API.
`src/services/api.js` sends each call to a handler in `src/services/handlers/` instead of over the
network, so there's one shared data source for every section of the app.
