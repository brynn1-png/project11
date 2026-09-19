# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js with React, TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase PostgreSQL, and Supabase Auth. Authentication, inventory reads, product registration, stock receiving, receipt-based sales, returns, and day verification are server-backed.

## Users

The primary users are grocery-store owners, managers, inventory personnel, and cashiers in Tiaong, Quezon. They use the system while receiving products, recording inventory releases, checking stock levels, and presenting inventory activity.

## Product Purpose

Inventory System helps a single grocery-store location register products, identify them through barcodes, automatically update quantities through receiving and customer purchases, monitor stock and expiry status, and produce inventory and gross-profit reports.

## Positioning

The product joins camera-based or hardware barcode identification directly to simple stock-movement workflows, including generated labels for grocery items that do not already have manufacturer barcodes.

## Operating Context

The system is used on desktop and laptop computers with built-in or external webcams, on mobile devices with cameras, and with USB barcode scanners that behave as keyboard input. Staff may be working quickly near shelves, receiving areas, or checkout counters.

## Capabilities and Constraints

- Product name: South Emerald Supermarket Inventory.
- Uses secure email-and-password authentication with administrator, manager, inventory staff, and cashier roles.
- Supports dashboard, products, inventory, stock-in, receipt-based sales, returns, sales verification, transaction history, reports, and user management.
- Camera scanning supports compatible cameras exposed by the browser and lets users choose among available devices.
- Manual barcode entry remains available when camera scanning is unavailable or unreliable.
- Products, on-hand quantities, inventory activity, and administrator-visible user profiles are loaded from PostgreSQL.
- The Sales workspace combines product scanning and stock-out recording. Each successful scan immediately adds one unit to the local receipt cart, repeated scans increment the same product line, and quantities remain editable in Current sale. A configured `F9` scanner prefix plus `Enter` suffix enables scan-anywhere routing without corrupting focused quantity or notes fields. Supabase is updated only when the cashier confirms the complete receipt as one atomic database transaction.
- Cash checkout requires the amount received, displays change before confirmation, and validates payment against the database-calculated total. Each confirmed sale issues a complete receipt with cashier, product lines, total, cash received, and change; scanning pauses until the receipt is printed/saved or the cashier starts the next sale.
- Completed sales deduct non-expired inventory using FEFO batch allocation and idempotency protection. A sale is never confirmed from cached-only or offline data.
- Returns remain linked to their original sale, wait for administrator or manager review, and restore inventory only when approved as resellable. Recent sales are selectable by authorized staff, while exact sale-number lookup remains available for older receipts. Damaged, expired, and rejected returns do not increase available stock.
- Business days move from open to pending review to verified. Pending returns block verification only for their associated business day.
- The latest product catalog and activity are cached in IndexedDB to speed repeated lookup and tolerate transient data-loading failures while the application remains open. Supabase remains the source of truth, sale confirmation requires a live connection, and full offline application startup is not required.
- Administrators and managers can register and edit products and categories, assign one operational unit of measure, assign manufacturer barcodes or generated `INV-######` Code 128 labels, and archive products. A scanner may fill the manufacturer-barcode field, but its Enter suffix cannot submit the form; registration and edits require the explicit action button. Packaging details such as `175g` or `1.5L` belong in the product name or description. New-product registration can optionally create the first traceable inventory batch in the same atomic transaction; administrators, managers, and inventory staff can continue receiving later supplier batches through Stock In with purchase cost and expiry validation.
- Stock In uses the configured scanner prefix and suffix to select products from any focused receiving field. Scanning never changes inventory by itself; switching products clears the previous receiving draft, and confirmation remains mandatory.
- Products separates active and archived records. Administrators and managers may archive a zero-stock product with a reason and restore it later; products with stock or pending resellable returns remain active to prevent hidden inventory.
- Transactions separates inventory activity, permanent sales receipts, and permanent return history. History is searchable and role-scoped. A selected receipt opens in a modal with complete receipt and cash-payment details, returns linked to that sale, and a chronological sale/return/business-day verification timeline, plus 80 mm printing or browser Save as PDF.
- The header notification center derives low-stock and out-of-stock alerts from the latest inventory snapshot. Products are flagged when quantity is at or below their configured restock level; authorized staff can open the selected product directly in Stock In, while read-only users are routed to the matching Inventory filter.
- Product creation and stock receiving require a live database with the latest migration applied.
- The system does not include supplier management, delivery tracking, multi-location management, advanced warehouse management, full accounting, or payment processing.
- Camera access requires user permission and a secure browser context such as localhost or HTTPS.

## Evidence on Hand

Project requirements are recorded in `req.md`. The client supplied a low-resolution South Emerald Supermarket raster logo; approved full and compact SVG reconstructions are stored in `public/brand/` and applied to the system. No real customer records, commercial claims, testimonials, or production inventory data are available; the repository seed is development-only and clearly identified as synthetic.

## Product Principles

- Make stock movement immediately understandable.
- Optimize scanning and quantity updates for speed and low error rates.
- Keep inventory status visible and traceable.
- Keep development seed records separate from production business data.
- Work comfortably across desktop, webcam, and mobile-camera contexts.

## Accessibility & Inclusion

The responsive web interface should support keyboard navigation, visible focus states, readable contrast, clear labels, non-color status cues, and touch targets suitable for handheld use.
