# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js with React, TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase PostgreSQL, and Supabase Auth. Authentication and inventory reads are server-backed; atomic product, receiving, and sales write workflows are the next implementation phase.

## Users

The primary users are grocery-store owners, managers, inventory personnel, and cashiers in Tiaong, Quezon. They use the system while receiving products, recording inventory releases, checking stock levels, and presenting inventory activity.

## Product Purpose

Inventory System helps a single grocery-store location register products, identify them through barcodes, automatically update quantities through receiving and customer purchases, monitor stock and expiry status, and produce inventory and gross-profit reports.

## Positioning

The product joins camera-based or hardware barcode identification directly to simple stock-movement workflows, including generated labels for grocery items that do not already have manufacturer barcodes.

## Operating Context

The system is used on desktop and laptop computers with built-in or external webcams, on mobile devices with cameras, and with USB barcode scanners that behave as keyboard input. Staff may be working quickly near shelves, receiving areas, or checkout counters.

## Capabilities and Constraints

- Working name: Inventory System.
- Uses secure email-and-password authentication with administrator, manager, inventory staff, and cashier roles.
- Supports dashboard, products, inventory, barcode scanning and generation, stock-in, customer purchases, transaction history, reports, and user management.
- Camera scanning supports compatible cameras exposed by the browser and lets users choose among available devices.
- Manual barcode entry remains available when camera scanning is unavailable or unreliable.
- Products, on-hand quantities, inventory activity, and administrator-visible user profiles are loaded from PostgreSQL. Product creation, receiving, and customer-purchase writes remain disabled until their atomic database workflows are implemented.
- The system does not include supplier management, delivery tracking, multi-location management, advanced warehouse management, full accounting, or payment processing.
- Camera access requires user permission and a secure browser context such as localhost or HTTPS.

## Evidence on Hand

Project requirements are recorded in `req.md`. No real customer records, commercial claims, testimonials, logos, or production inventory data are available; the repository seed is development-only and clearly identified as synthetic.

## Product Principles

- Make stock movement immediately understandable.
- Optimize scanning and quantity updates for speed and low error rates.
- Keep inventory status visible and traceable.
- Keep development seed records separate from production business data.
- Work comfortably across desktop, webcam, and mobile-camera contexts.

## Accessibility & Inclusion

The responsive web interface should support keyboard navigation, visible focus states, readable contrast, clear labels, non-color status cues, and touch targets suitable for handheld use.
