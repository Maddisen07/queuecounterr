# 🎟️ QueueCounter

> A full-stack walk-in service queue web application for small service counters. Customers take a token, staff call them to a counter, and a display board shows queue status in real time.

---

## 📋 Features

- **Customer Intake (`#/join`)**:
  - Optional customer name (max 60) and service note (max 120).
  - Ticket-style card with a signature torn-ticket look (perforated divider, edge notches).
  - Live queue updates: position in line, "N ahead of you", and estimated wait time.
  - Prominent serving alert ("Please proceed to Counter X").
  - "Leave queue" button (waiting tokens only).
  - Automatically persists the active token in `localStorage`, and safely clears it if the server returns 404.
  - Live snapshot banner showing how many customers are waiting and the wait time if joining now.

- **Staff Dashboard (`#/staff`)**:
  - Live stats row: Waiting count, Open counters count, Average service time, and Next arrival estimated wait.
  - Interactive counter cards with **Open/Close**, **Call Next**, **Mark Complete**, and **No-Show** actions.
  - Concurrency-safe customer dispatching (ensures two staff members cannot claim the same customer, or assign one counter multiple customers).
  - Inline counter renaming and deletion (safely prevented while serving).
  - Add counter form (max 40 characters, unique names enforced).
  - Real-time waiting list table with live elapsed wait timers and estimated service times.

- **Display Board (`#/board`)**:
  - Waiting-room display designed to be easily readable from across a room.
  - Large "Now Serving" grid highlighting active counters and huge token digits.
  - "Up Next" preview showing the next 8 waiting tokens.
  - Prominent banner showing current estimated wait time for new arrivals.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Plain CSS with modern CSS variables, Responsive design (360px+ to 4K).
- **Backend**: Node.js 18+ (tested on Node 24), Express REST API using ES modules (`"type": "module"`).
- **Database**: MongoDB with Mongoose (optimized for **MongoDB Atlas** or local instances).
- **Configuration**: `dotenv` (`server/.env`, with `server/.env.example`).
- **Tests**: Native Node test runner (`node:test` & `node:assert/strict`).

---

## 🗄️ MongoDB Atlas Setup Guide

QueueCounter is configured for **MongoDB Atlas**. Follow these steps to connect your Atlas database:

1. **Sign Up / Log In**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. **Create a Free Cluster**:
   - Select **Deploy a database** -> Choose the free **M0 Shared** tier.
   - Choose your preferred cloud provider and region, then click **Create Deployment**.
3. **Set Up Database Access (User)**:
   - In Atlas, navigate to **Security** -> **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password Authentication**. Enter a username and secure password (e.g., `admin` and a strong password).
   - Set user privileges to **Read and write to any database** (or `dbOwner`).
   - Click **Add User**.
4. **Set Up Network Access (IP Whitelist)**:
   - In Atlas, navigate to **Security** -> **Network Access**.
   - Click **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) for development access, or add your current IP address.
   - Click **Confirm**.
5. **Get Your Connection String**:
   - Go to **Deployments** -> **Database** and click the **Connect** button on your cluster.
   - Select **Drivers** (Node.js).
   - Copy the SRV connection string:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```
6. **Configure `server/.env`**:
   - In the `server/` directory, open `.env` (or copy `.env.example` to `.env`):
     ```env
     PORT=5000
     CLIENT_ORIGIN=http://localhost:5173
     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/queuecounter?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with the credentials created in Step 3. (Make sure to append `/queuecounter` before `?retryWrites`).

> **Note**: If you want to run offline or test locally, you can also use a local MongoDB URI:
> `MONGODB_URI=mongodb://127.0.0.1:27017/queuecounter`

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js 18+ (verified on Node 24)
- npm 9+

### 1. Install All Dependencies
From the project root:
```bash
npm run install:all
```
This installs dependencies for both `server/` and `client/`.

### 2. Configure Environment
Ensure `server/.env` contains your `MONGODB_URI` (see [MongoDB Atlas Setup Guide](#-mongodb-atlas-setup-guide) above).

### 3. Run in Development Mode
You can run the backend and frontend concurrently in two terminals:

**Terminal 1 (Backend API):**
```bash
npm run dev:server
```
Runs Express server with `node --watch` on [http://localhost:5000](http://localhost:5000).

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
```
Runs Vite dev server with proxy on [http://localhost:5173](http://localhost:5173).

### 4. Run in Production Mode
Build the client and start the production server (which serves the built frontend):
```bash
npm run build
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

### 5. Run Unit Tests
Execute the unit tests using Node's native test runner:
```bash
npm test
```

---

## 📐 Data Models

### 1. Token (`Token.js`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `label` | String | Formatted ticket label (e.g. `Q-001`, `Q-007`). |
| `number` | Number | Sequential integer (1, 2, 3...) resetting daily. |
| `day` | String | Date string (`YYYY-MM-DD`). |
| `customerName` | String | Optional, trimmed, max 60 characters. |
| `note` | String | Optional, trimmed, max 120 characters. |
| `status` | String | Enum: `waiting`, `serving`, `completed`, `cancelled`, `no_show`. Default: `waiting`. |
| `counter` | ObjectId (Ref: Counter) | Reference to the counter serving this token (null if waiting). |
| `calledAt` | Date | Timestamp when customer was called to a counter. |
| `completedAt` | Date | Timestamp when customer finished or was marked no-show/cancelled. |
| `serviceDurationSec`| Number | Duration in seconds (`completedAt - calledAt`), null for no-shows. |
| `createdAt` / `updatedAt` | Date | Automatic Mongoose timestamps. |

*Compound Unique Index:* `{ day: 1, number: 1 }` (ensures sequence numbers restart each day and remain strictly unique).

### 2. Counter (`Counter.js`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Unique counter name, trimmed, max 40 characters. |
| `isActive` | Boolean | Whether counter is open (`true`) or closed (`false`). |
| `currentToken` | ObjectId (Ref: Token) | Reference to token currently being served (null if idle). |
| `createdAt` / `updatedAt` | Date | Automatic Mongoose timestamps. |

### 3. Sequence (`Sequence.js`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `day` | String (Unique) | Current date (`YYYY-MM-DD`). |
| `seq` | Number | Atomically incremented sequence counter using MongoDB `$inc`. |

---

## ⏱️ Wait-Time Estimation Algorithm

The wait estimation logic is implemented as a **pure, unit-tested function** in [`server/src/utils/waitEstimate.js`](file:///server/src/utils/waitEstimate.js).

### Algorithm Details:
1. **Average Service Time Calculation**:
   - The system calculates the arithmetic mean of the last 20 completed services (excluding no-shows and cancellations).
   - If no historical completed service data exists yet, it defaults to **5 minutes (300 seconds)**.
2. **Counter Free-In Time**:
   - For every open counter (`isActive: true`):
     - If the counter is **idle** (`currentToken === null`): its free-in time is **0 seconds**.
     - If the counter is **busy** serving a customer: its free-in time is:
       $$\text{freeInSec} = \max(0, \text{avgServiceTimeSec} - \text{timeAlreadySpentOnCurrentCustomer})$$
       where $\text{timeAlreadySpent} = (\text{now} - \text{calledAt}) / 1000$.
     - If the current service has overrun the average, the free-in time is clamped to **0 seconds** (counter is expected to free up any moment).
3. **Queue Simulation (Greedy Scheduling)**:
   - Walk the waiting list in chronological arrival order.
   - For each customer in line:
     - Assign them to whichever counter frees up earliest ($\min(\text{counterFreeTimes})$).
     - The customer's estimated wait is that counter's current free-in time.
     - That counter's free-in time is then incremented by one average service duration ($\text{freeInSec} += \text{avgServiceTimeSec}$).
4. **New Arrival Wait**:
   - After scheduling all waiting customers, the estimated wait time for the next walk-in arrival is the minimum free-in time across all open counters.
5. **No Open Counters**:
   - If all counters are closed, the function returns `null` for all waiting estimates and the new arrival wait, and the UI displays a clear "Counters Closed" notice.

### Unit Tests:
The test suite in [`server/src/test/waitEstimate.test.js`](file:///server/src/test/waitEstimate.test.js) comprehensively covers:
1. **No data**: Defaults to 5 minutes (300s).
2. **Idle counter**: Waiting customer gets 0s wait; next arrival is 1 avg duration.
3. **Busy counter**: Wait is $\text{avg} - \text{spent}$.
4. **Multiple counters**: Greedy dispatch to earliest available counter.
5. **Overrunning service**: Spent time $>$ average clamps free-in time to 0.
6. **No open counters**: Returns `null` estimate.
7. **Rolling history**: Only the last 20 completed service durations are used.

---

## 🔒 Concurrency & Race-Condition Safety

When multiple staff members call customers simultaneously, QueueCounter protects against race conditions:
1. **Atomic Token Claim**:
   `Token.findOneAndUpdate({ _id: candidateTokenId, status: 'waiting' }, { status: 'serving', counter: counterId, calledAt: now }, { new: true })`
   If another counter claimed the candidate token in the exact same millisecond, the query returns `null`, and the loop safely advances to the next waiting customer.
2. **Atomic Counter Claim**:
   `Counter.findOneAndUpdate({ _id: counterId, isActive: true, currentToken: null }, { currentToken: claimedTokenId }, { new: true })`
   Ensures the counter was not closed or assigned another customer concurrently.
3. **Automatic Rollback**:
   If the counter claim fails after claiming a token, the claimed token is immediately rolled back to `{ status: 'waiting', counter: null, calledAt: null }` and a `409 Conflict` is returned.

---

## 📡 API Reference

All requests and responses use JSON. Error responses follow `{ error: string, details?: any }`.

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tokens` | Join queue. Body: `{ customerName?, note? }`. Returns token, `position`, `estimatedWaitSec`. | `201`, `400` |
| `GET` | `/api/tokens/:id` | Get token details, current position, and wait estimate while waiting. | `200`, `400`, `404` |
| `GET` | `/api/tokens` | List tokens. Query params: `status`, `limit` (max 200). | `200`, `400` |
| `POST` | `/api/tokens/:id/cancel`| Leave queue (waiting tokens only). | `200`, `400`, `404`, `409` |
| `GET` | `/api/queue` | Complete snapshot: counters, waiting list with estimates, avg service time, open counter count, next arrival wait. | `200` |
| `GET` | `/api/counters` | List all counters with currently served token. | `200` |
| `POST` | `/api/counters` | Create counter. Body: `{ name }` (max 40 chars, unique). | `201`, `400`, `409` |
| `PATCH` | `/api/counters/:id` | Rename or open/close counter. Body: `{ name?, isActive? }`. Cannot close while serving. | `200`, `400`, `404`, `409` |
| `DELETE`| `/api/counters/:id` | Delete counter. Cannot delete while serving. | `200`, `400`, `404`, `409` |
| `POST` | `/api/counters/:id/call-next` | Concurrently-safe call for oldest waiting token. | `200`, `404`, `409` |
| `POST` | `/api/counters/:id/complete` | Complete current customer, free counter, and record `serviceDurationSec`. | `200`, `404`, `409` |
| `POST` | `/api/counters/:id/no-show` | Mark customer no-show and free counter without duration. | `200`, `404`, `409` |
| `GET` | `/api/health` | Service health check with DB connection state and uptime. | `200` |

---

## ⚠️ Security Notice

> [!WARNING]
> **No Staff Authentication**: By default, this application does not include staff login or role-based authentication. The `#/staff` screen and `/api/counters/*` mutation endpoints are publicly accessible via the browser hash route. **Before deploying to a public or production environment, you must place the Counters screen and API routes behind an authentication/authorization layer** (such as HTTP Basic Auth, session-based auth, reverse-proxy auth, or an identity provider like Auth0/Firebase Auth).

---

## 🎨 Design & Accessibility

- **Color Palette**:
  - Ink-navy (`#16202b`): Professional dark tone for headers and high-contrast text.
  - Light Mist (`#f3f6f9`): Soft, glare-free background.
  - Ticket-yellow (`#ffc845`): Warm paper ticket accents and active badges.
  - Teal (`#0f766e` / `#14b8a6`): High-visibility serving state and callout notifications.
  - Error Red (`#dc2626`): Strictly reserved for errors and cancellations.
- **Typography**:
  - Headers & Big Numbers: **Big Shoulders Display**
  - Body Text: **Public Sans**
- **Signature Component**:
  - The customer ticket features a authentic perforated divider with dashed line and semicircle edge notches.
- **Accessibility**:
  - Clear `:focus-visible` outlines.
  - `role="alert"` for real-time error notifications.
  - `aria-live="polite"` on the customer ticket to announce when a customer is called to a counter.
  - Semantic HTML forms with explicit `<label htmlFor="...">` bindings.
  - Fully responsive across mobile (360px+), tablet, and desktop display screens.
