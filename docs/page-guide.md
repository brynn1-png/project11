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

**Flow:** Search/filter the catalog, then create or edit a product, manage categories, print a barcode, or switch to archived products to restore them. Managers may archive products; permanent deletion is restricted further to administrators. From a product, **Receive stock** opens Receive Stock with that product selected. Product registration can optionally include opening stock, then continue to a stock receipt.

### Sales

**Purpose:** Record a customer sale using a barcode scanner, camera scan, or manual product entry.

**Flow:** Scan or enter products to build the cart, adjust quantities, enter cash received, and confirm the sale. The app validates available stock and records the sale; a completed sale produces a receipt that can be reviewed or printed. The scanner also has a price-check mode. Confirmed sales update inventory and become available in activity/history and reporting. If connectivity is unavailable, the sale cannot be confirmed against the live database.

### Returns

**Purpose:** Request a return against a completed sale.

**Flow:** Find a recent sale by sale number or cashier, select it, choose return quantities and each item's condition (resellable, damaged, or expired), add a reason and optional notes, then submit for manager review. A sale with a pending return or no remaining returnable quantity cannot be selected again. The request appears in Daily Verification; approval/rejection is performed there.

### Receive Stock

**Purpose:** Record incoming inventory and its batch details.

**Flow:** Search for or scan a product (or arrive from an alert/product shortcut), enter quantity and unit cost, and provide relevant batch, manufacture/expiry, delivery reference, and notes. Submit the receipt to update stock and create a traceable receiving record. If the product does not exist, users with product-management permission can jump to Products to register it. Receiving requires a live database connection.

### Stock Levels

**Purpose:** Inspect current quantities and replenishment status across products.

**Flow:** Choose All, In Stock, Low Stock, or Out of Stock to filter the table. The table shows product, category, current quantity, minimum level, status, and last update. Open this view from the sidebar or from a stock alert when the user cannot receive stock.

### Activity & Receipts

**Purpose:** Search historical stock movements, sales receipts, and returns.

**Flow:** Switch among **Stock activity**, **Sales receipts**, and **Customer returns**. Stock activity can be filtered by movement type and searched; receipts and returns can be searched as well. Selecting a sale receipt opens its details, related returns, and activity, with an option to print or save as PDF.

### Daily Verification

**Purpose:** Review business-day sales totals and resolve pending return requests.

**Flow:** Review a day's sale count, items, returns, and gross sales. Submit an open day for review, then mark a submitted day verified when ready. Any pending returns for that day must be reviewed first. Approve or reject each pending return here; only approved resellable items return to available inventory. A daily record is created automatically when the first sale is confirmed.

### Reports

**Purpose:** Analyze sales and inventory, stock movement, low stock, and expiry information.

**Flow:** Choose a report, set its date range or other report-specific filters, then search and page through the results. Sales can be viewed grouped by receipt or by item. Available reports and fields depend on the user's reporting permissions. CSV download and print options are available where supported.

### Staff Accounts

**Purpose:** View staff profiles, roles, and active/inactive status.

**Flow:** Open from the Administration navigation group when permitted, then review the staff list. This view is read-only in the current interface; account creation and role changes are not provided here.

## Common end-to-end paths

### Daily sales

Dashboard → Sales → scan/build cart → confirm payment → receipt. The sale reduces stock, creates activity/receipt records, and contributes to the business day's verification and reports.

### Replenishment

Dashboard alert or Products → Receive Stock → select product → enter receipt and batch details → submit. The updated quantity is reflected in Stock Levels and the Dashboard.

### Return review

Returns → select completed sale → choose item quantities/conditions → submit request → Daily Verification → approve or reject. Approved resellable quantities are returned to available stock.

### End-of-day control

Daily Verification → review business-day totals and pending returns → submit the day for review → resolve outstanding returns → mark the day verified.

## Notes on navigation and permissions

- Sidebar selections change the current view inside `/`; they do not create a deep-link URL for each view.
- Role permissions affect which navigation items and actions are visible or allowed. Server-side actions also enforce permissions.
- Dashboard and read-only views may use cached inventory when live data is unavailable. Actions that change inventory or sales require a live connection.
- The app's error, loading, and not-found route files provide shared route-level states rather than additional business pages.
