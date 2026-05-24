# Design & Development of a Role-Based E-commerce Web Application

A complete, production-grade, and framework-less E-commerce Web Application designed as a university Integrated Design Project (IDP). The platform features an integrated, state-guarded order fulfillment lifecycle involving four distinct user roles: **Admin**, **Seller**, **Customer (Student)**, and **Service Team**.

---

## ━━━━━━━━━━━━━━━━━━━━━━
## IMPORTANT ARCHITECTURAL COMPLIANCE
## ━━━━━━━━━━━━━━━━━━━━━━
This application is built strictly **WITHOUT external frameworks** at any stage, in compliance with academic grading criteria:
*   **No Frontend Frameworks**: 100% Vanilla HTML5, CSS3 Custom Design System (Dark Mode/Glassmorphism theme), and Vanilla JavaScript DOM manipulation. No React, Next, Angular, jQuery, Bootstrap, or Tailwind CSS is imported.
*   **No Backend Frameworks**: Built using pure Node.js native libraries. No Express.js, Koa, Fastify, or NestJS is utilized.
*   **Raw HTTP Engine**: Manual streams buffer JSON request parsing and native URL routing mappings.
*   **Native Cryptography**: Customs signature-signed session tokens and PBKDF2 (SHA512) password hashing are implemented using the core Node.js `crypto` library.
*   **Oracle Database Integration**: Native integrations configured using the official `oracledb` client.
*   **Smart SQL Mock Fallback**: Includes a robust dynamic local JSON-fallback database engine (`MockDB`) that automatically starts if Oracle Database credentials are absent. **This ensures the system works 100% out-of-the-box on any grading computer without database configuration, while still preserving fully functional Oracle SQL statements in the source code!**

---

## 🏗️ Folder Structure

```text
idp1/
├── client/
│   ├── index.html            # Campus Shopping Catalog & Cart Drawer
│   ├── css/
│   │   └── style.css         # Custom Premium Design System Theme
│   ├── js/
│   │   ├── api.js            # Unified Fetch REST client
│   │   ├── auth.js           # Session token & redirect guards
│   │   ├── dashboards.js     # Dashboards controller logic (Shared/4 Roles)
│   │   └── store.js          # Cart state, search queries, filters
│   ├── pages/
│   │   ├── login.html        # Custom Auth Sign-in page
│   │   ├── register.html     # Custom Auth Signup page
│   │   ├── admin.html        # Administrator console
│   │   ├── seller.html       # Seller merchant console
│   │   ├── customer.html     # Student Customer tracker dashboard
│   │   └── service.html      # Logistics & Operations dashboard
│
├── server/
│   ├── server.js             # Core HTTP Web Server & stream body parser
│   ├── routes.js             # API path mapping registry
│   ├── controllers/
│   │   ├── authController.js # Signup, logins, token generation
│   │   ├── prodController.js # Product listings catalog & inventories
│   │   ├── ordController.js  # Order pipelines, logistics transactions
│   │   ├── userController.js # Admin accounts management & aggregates
│   │   └── msgController.js  # Coordinated bridge chats & notification CRUD
│   ├── middleware/
│   │   └── authMiddleware.js # Token authentication & role validators
│   ├── database/
│   │   ├── connection.js     # Oracle DB connector / Mock dynamic fallback
│   │   └── mockDb.js         # Local database backup engine with JSON storage
│   └── utils/
│       ├── cryptoUtils.js    # PBKDF2 cryptography & HMAC signatures
│       └── responseUtils.js  # Standard JSON responses & static file streaming
│
├── sql/
│   └── schema.sql            # Core Oracle SQL database schema script
│
├── package.json              # Startup configurations
└── README.md                 # Complete system documentation
```

---

## ⚡ Instant Setup & Execution

### Prerequisites
*   Node.js installed (v16.0.0 or higher recommended).
*   *Optional*: A local Oracle Database XE/EE instance.

### Installation & Launch
1.  Extract the project folder and navigate to the project directory in your terminal:
    ```bash
    cd c:\projects\idp1
    ```
2.  Install the optional Oracle DB connector:
    ```bash
    npm install
    ```
3.  Launch the integrated Node.js server:
    ```bash
    npm start
    ```
4.  Open your browser and navigate to the application portal:
    ```text
    http://localhost:3000
    ```

> [!NOTE]
> **Active Mode Console Alert**: At startup, the console will log a status notification verifying if it is connected to a live Oracle Database instance, or has activated the **SQL-Mock JSON Fallback Engine** (`server/database/db_store.json`). If running in Mock Fallback mode, all registrations, inventory uploads, chat messages, and order updates will persist dynamically inside the JSON file!

---

## 👤 Pre-Seeded Academic Test Credentials

The database contains pre-configured users matching each of the four roles. Password for all seeded credentials is `<role_name>123`:

| Username | Password | Full Name | Account Role |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | System Administrator | Admin (1) |
| **`seller`** | `seller123` | Elite Campus Seller | Seller (2) |
| **`customer`** | `customer123` | John Doe Student | Customer (3) |
| **`service`** | `service123` | Operations Coordinator | Service Team (4) |

---

## 🔄 The 6-Step Transactional Fulfillment Workflow

To demonstrate the full capability of the integrated role-based workflows for your presentation, run this step-by-step simulation path:

1.  **Product Listing (Seller)**:
    *   Sign in as **`seller`** / `seller123`.
    *   List a new item using the "Upload New Product" form.
2.  **Purchase Checkout (Customer)**:
    *   Go to the homepage `/` (click *Browse Catalog*).
    *   Add your uploaded item to the cart and click "Submit Order for Approval".
    *   Sign in as **`customer`** / `customer123` when prompted to complete checkouts.
    *   Your Order is registered in the system as `PENDING`.
3.  **Operational Review (Service Team)**:
    *   Sign in as **`service`** / `service123`.
    *   Under the orders ledger, review the pending transaction and click **Approve**.
    *   Your Order state changes to `APPROVED`.
4.  **Warehouse Dispatch (Seller)**:
    *   Sign back in as **`seller`**.
    *   Under incoming approved orders, locate your order and click **Deliver to Warehouse**.
    *   Your Order state changes to `DELIVERED_TO_WAREHOUSE`.
5.  **Quality Auditing & Delivery (Service Team)**:
    *   Sign back in as **`service`**.
    *   A quality audit log has arrived in your ledger. Inspect quantities and click **Verify items match**. (Order state changes to `VERIFIED_IN_WAREHOUSE`).
    *   Click **Dispatch Delivery** to assign couriers and ship items to dorms. (Order state changes to `DISPATCHED`).
6.  **Fulfillment Confirmation (Customer)**:
    *   Sign back in as **`customer`**.
    *   Observe the vertical tracking stepper showing 5 complete nodes.
    *   Click **Confirm Physical Package Arrival** to finalize the order.
    *   Your Order state shifts to `COMPLETED`. Transaction completed.

---

## 🔒 Coordinated Communication Bridge Channels
Sellers and Students can **never** contact each other directly to prevent collusion.
*   **Customer Support**: From the Customer tracking dashboard, clicking *Support* opens a chat modal. Messages sent here are addressed exclusively to the Service Team.
*   **Seller Inquiries**: From the Seller hub, clicking *Message Service* opens a chat modal. Messages sent here are addressed exclusively to the Service Team.
*   **Service Bridge**: From the Service console, clicking **Bridge Chat** enables selecting whether to talk to the Customer or the Seller, allowing the coordinator to coordinate shipping disputes and relay information seamlessly!

---

## 🛡️ Administrative System Panel
Signing in as **`admin`** unlocks root supervisor controls:
1.  **Campus User Directory**: Shows a complete list of all accounts. Toggling **Suspend** instantaneously deactivates an account, preventing them from logging in.
2.  **SVG Analytics Engine**: A hand-crafted dashboard graph built using native XML vectors illustrating real-time sales ratios and pipeline fulfillment distributions dynamically.
