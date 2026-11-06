# Page and workflow guide

This document describes the user-facing pages and the main paths between them in South Emerald's inventory and sales app. The navigation labels below are **views in the authenticated application**, not separate URLs: they are selected in the sidebar while the browser remains at `/`. The login screen is the separate `/login` route.

## How users enter the app

1. Visiting `/` checks for an authenticated staff account. Signed-out users are sent to `/login`.
2. `/login` shows the sign-in form when Supabase is configured. If it is not configured, the page explains the required environment setup. A signed-in user visiting `/login` is sent back to `/`.
3. After sign-in, the app loads the inventory snapshot and opens the Dashboard. A data-status label indicates whether the app has live, cached, or unavailable inventory data.
4. The sidebar shows only views allowed for the user's role. Staff details and the sign-out action are at its bottom. On small screens, the sidebar opens as a drawer.

## Authenticated views

### Dashboard

**Purpose:** Give staff a quick overview of inventory health and recent activity. The summary metrics vary by role; charts show stock movement and inventory health, while attention items identify low or out-of-stock products.

**Flow:** Start here after login. Use **Open sales** to start recording a sale, **Receive stock** or a restock attention item to receive inventory (if permitted), and **View all** beside recent activity to open Activity & Receipts. The stock-alert bell also provides shortcuts: users with receiving permission go to Receive Stock with the product selected; other users go to Stock Levels filtered to that alert status.

### Products

**Purpose:** Search and manage the active product catalog, categories, barcode labels, and archived products. Product creation and editing controls depend on permissions.

**Flow:** Search/filter the catalog, then create or edit a product, manage categories, print a barcode, or switch to archived products to restore them. The catalog shows the earliest active batch expiry and separates on-hand from sellable stock. Managers can view active batches and correct their expiry dates together from the product editor. Managers may archive products; permanent deletion is restricted further to administrators. From a product, **Receive stock** opens Receive Stock with that product selected. Product registration can optionally include opening stock, then continue to a stock receipt.

### Sales

**Purpose:** Record a customer sale using a barcode scanner, camera scan, or manual product entry.

**Flow:** Scan or enter products to build the cart, adjust quantities, enter cash received, and confirm the sale. The app validates available stock and records the sale; a completed sale produces a receipt that can be reviewed or printed. The scanner also has a price-check mode. Confirmed sales update inventory and become available in activity/history and reporting. If connectivity is unavailable, or the cashier has already remitted that day, the sale cannot be confirmed.

### Returns

**Purpose:** Request a return against a completed sale.

**Flow:** Find a recent sale by sale number or cashier, select it, choose return quantities and each item's condition (resellable, damaged, or expired), add a reason and optional notes, then submit for manager review. A sale with a pending return or no remaining returnable quantity cannot be selected again. The request appears in Daily Verification; approval/rejection is performed there.

### Receive Stock

**Purpose:** Record incoming inventory and its batch details.

**Flow:** Search for or scan a product (or arrive from an alert/product shortcut), enter quantity and unit cost, and provide relevant batch, manufacture/expiry, delivery reference, and notes. For expiry-tracked products, each new delivery also sets the new expiry on every older batch with stock remaining; previous dates are recorded in the audit log. A delivery with an expiry earlier than an active batch's current expiry is rejected. Submit the receipt to update stock and create a traceable receiving record. If the product does not exist, users with product-management permission can jump to Products to register it. Receiving requires a live database connection.

### Product Issues

**Purpose:** Report damaged or questionable stock and prevent affected units from being sold while management reviews them.

**Flow:** Search or scan a product, enter the affected quantity, optionally select the known batch, choose Damaged, Other issue, or Custom flag, and describe the problem. Submission immediately removes the units from available batches and creates a pending issue report. All active staff can see the shared report list. Administrators and managers add a resolution note to confirm the loss or return the same units to their batches. An archived product or expired batch cannot be returned to sellable stock.

### Stock Levels

**Purpose:** Inspect current quantities and replenishment status across products.

**Flow:** Choose All, In Stock, Low Stock, or Out of Stock to filter the table. The table shows product, category, current quantity, minimum level, status, and last update. Open this view from the sidebar or from a stock alert when the user cannot receive stock.

### Activity & Receipts

**Purpose:** Search historical stock movements, sales receipts, and returns.

**Flow:** Switch among **Stock activity**, **Sales receipts**, and **Customer returns**. Stock activity can be filtered by movement type and searched; receipts and returns can be searched as well. Selecting a sale receipt opens its details, related returns, and activity, with an option to print or save as PDF.

### Daily Verification

**Purpose:** Cashiers remit their own daily sales; managers and administrators review cashier remittances, business-day sales totals, and pending returns.

**Flow:** A cashier opens **My Daily Sales**, reviews only their own completed receipts and total, then selects **Remit my sales** when their shift ends. That cashier cannot confirm another sale for the day unless an administrator reopens their remittance while the store day is open. Managers and administrators see each cashier's remittance in **Daily Verification**. After every cashier with sales has remitted, they can submit the store day for review and later mark it verified. Pending returns for that day must be reviewed first. Only managers and administrators approve or reject returns. A daily record is created automatically when the first sale is confirmed.

### Reports

**Purpose:** Analyze sales and inventory, stock movement, low stock, and expiry information.

**Flow:** Choose a report, set its date range or other report-specific filters, then search and page through the results. Sales can be viewed grouped by receipt or by item. Available reports and fields depend on the user's reporting permissions. CSV download and print options are available where supported.

### Staff Accounts

**Purpose:** View staff profiles, roles, and active/inactive status.

**Flow:** Open from the Administration navigation group when permitted, then review the staff list. This view is read-only in the current interface; account creation and role changes are not provided here.

### Diagnostics

**Purpose:** Find when a server operation failed and read its recorded reason and reference ID.

**Flow:** The active administrator signed in as `admin@gmail.com` opens **Diagnostics** from Private administration or directly at `/diagnostics`. Search by function or operation name, open a record for the error code and stack when available, and load older records as needed. Browser-only failures and failures before deployment are outside this page's coverage. If database logging is unavailable, inspect server logs using the reference ID.

## Common end-to-end paths

### Daily sales

Dashboard → Sales → scan/build cart → confirm payment → receipt. The sale reduces stock, creates activity/receipt records, and contributes to the business day's verification and reports.

### Replenishment

Dashboard alert or Products → Receive Stock → select product → enter receipt and batch details → submit. The updated quantity is reflected in Stock Levels and the Dashboard.

### Damaged or questionable stock

Product Issues → select product and affected quantity → submit report → management confirms the loss or returns eligible units to stock. The report and stock movements remain in history.

### Return review

Returns → select completed sale → choose item quantities/conditions → submit request → Daily Verification → approve or reject. Approved resellable quantities are returned to available stock.

### End-of-day control

My Daily Sales → each cashier reviews and remits their own sales → Daily Verification → management reviews all cashier remittances and submits the store day → resolves outstanding returns → marks the day verified.

## Notes on navigation and permissions

- Sidebar selections change the current view inside `/`; they do not create a deep-link URL for each view.
- Role permissions affect which navigation items and actions are visible or allowed. Server-side actions also enforce permissions.
- Dashboard and read-only views may use cached inventory when live data is unavailable. Actions that change inventory or sales require a live connection.
- The app's error, loading, and not-found route files provide shared route-level states rather than additional business pages.
