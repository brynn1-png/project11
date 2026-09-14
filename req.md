Inventory Management System with Automated Stock Updates Using Barcode Scanning

Project Needs and Requirements

Project Title

Design and Development of an Inventory Management System with Automated Stock Updates Using Barcode Scanning for Grocery Stores in Tiaong, Quezon

1. Project Overview

The proposed system is an Inventory Management System intended for grocery stores. Its main purpose is to improve inventory accuracy, reduce manual recording, automate stock updates, and use barcode scanning for faster product identification.

The system is focused on inventory monitoring and stock movement rather than full point-of-sale or warehouse management.

2. Main Project Goals

The system should:

Computerize inventory monitoring.

Use barcode scanning for faster product identification.

Generate and assign barcodes to products that do not already have one.

Automatically update stock quantities when products are added or released.

Reduce manual data-entry errors.

Improve the accuracy and efficiency of stock monitoring.

Generate inventory reports.

Be evaluated using the ISO/IEC 25010 software quality model.

3. Target Users

Based on the project document, the expected users are:

Grocery store owner or manager

Cashiers

Inventory personnel

These users are directly involved in:

Receiving products

Scanning barcodes

Recording stock-in transactions

Recording stock-out transactions

Monitoring current stock levels

4. Core System Modules

4.1 User Authentication

The system should provide secure access for authorized users.

Basic requirements

Login

Logout

User account management

Session handling

Recommended user roles

Administrator

Manager

Inventory Staff

Cashier

Note: Exact user roles are not fully defined in the research document. These roles are recommended for implementation.

4.2 Dashboard

The dashboard should provide a quick summary of inventory information.

Recommended dashboard data

Total number of products

Total stock quantity

Low-stock products

Out-of-stock products

Recent stock-in transactions

Recent stock-out transactions

Inventory activity summary

5. Product Management

The system must support product registration and inventory-related product information.

Required product information

Recommended fields include:

Product ID

Product name

Barcode

Category

Description

Unit

Current stock quantity

Minimum stock level

Date created

Date updated

Required product functions

Add product

Edit product

View product

Delete or archive product

Search products

Filter products

View current stock quantity

6. Category Management

Recommended category functions:

Add category

Edit category

Delete category

Assign products to categories

Filter products by category

Example categories:

Beverages

Canned Goods

Snacks

Rice

Sugar

Flour

Household Supplies

Category management is a recommended supporting feature. The research document does not explicitly define a category module.

7. Barcode Management

Barcode technology is one of the main requirements of the project.

7.1 Existing Product Barcodes

For products that already have manufacturer barcodes:

Scan the existing barcode.

Save the barcode to the corresponding product.

Retrieve the product when the barcode is scanned again.

7.2 Generated Barcodes

For products without existing barcodes, such as sugar or flour:

Generate a unique barcode.

Assign the barcode to the product.

Allow the barcode to be printed.

Store the barcode in the database.

Use the generated barcode for future scanning.

7.3 Barcode Scanner Support

The system should support barcode input through one or both of the following:

Option A — USB Barcode Scanner

A USB barcode scanner can function as keyboard input.

Option B — Phone Camera

A mobile-friendly web application can use the phone camera to scan supported barcode formats.

Recommended formats:

EAN-13

EAN-8

UPC-A

UPC-E

Code 128

Code 39

Exact barcode formats are not specified in the research document. These are implementation recommendations.

8. Stock-In Module

The stock-in module records products entering the inventory.

Required functions

Scan product barcode.

Identify the product.

Enter stock-in quantity.

Record the transaction.

Automatically increase the product's inventory quantity.

Record date and time.

Record the responsible user.

Recommended transaction information

Transaction ID

Product ID

Product name

Barcode

Quantity added

Previous stock

Updated stock

User

Date

Time

Notes

9. Stock-Out Module

The stock-out module records products leaving the inventory.

Required functions

Scan product barcode.

Identify the product.

Enter stock-out quantity.

Validate available stock.

Record the transaction.

Automatically decrease inventory quantity.

Prevent invalid negative stock.

Record date and time.

Record the responsible user.

Recommended transaction information

Transaction ID

Product ID

Product name

Barcode

Quantity removed

Previous stock

Updated stock

User

Date

Time

Notes

10. Automatic Stock Updating

Automatic stock adjustment is one of the main project requirements.

Expected behavior

Stock-In

New Stock = Current Stock + Stock-In Quantity

Stock-Out

New Stock = Current Stock - Stock-Out Quantity

The system should update stock immediately after a valid transaction.

11. Inventory Monitoring

The inventory module should provide the current status of all products.

Required functions

View all inventory

Search inventory

View current stock quantity

View product barcode

View stock movement

Identify low-stock products

Identify out-of-stock products

Recommended inventory statuses

In Stock

Low Stock

Out of Stock

12. Inventory Transaction History

The system should maintain a complete record of inventory movement.

Recommended filters

Product

Barcode

Transaction type

User

Date range

Transaction types

Stock-In

Stock-Out

The history should help users trace changes in inventory quantities.

13. Reports

The research document specifically requires inventory report generation.

Minimum reports

Current inventory report

Stock-in report

Stock-out report

Product movement report

Recommended additional reports

Low-stock report

Out-of-stock report

Daily inventory transactions

Weekly inventory transactions

Monthly inventory transactions

Recommended export formats

PDF

Excel

CSV

Printable report

Export formats are not explicitly stated in the research document and are implementation recommendations.

14. Search and Filtering

The system should allow users to quickly locate inventory records.

Recommended search criteria:

Product name

Barcode

Category

Recommended filters:

Category

Stock status

Transaction type

Date

User

15. Audit Trail

A basic audit trail is recommended to improve accountability.

Possible recorded activities:

User login

Product creation

Product modification

Product deletion/archive

Stock-in

Stock-out

Barcode generation

Recommended audit log data:

User

Action

Affected record

Date

Time

16. Database Requirements

A relational database is recommended.

Recommended tables

users

id

name

email / username

password / authentication ID

role

created_at

products

id

name

barcode

category_id

description

unit

stock_quantity

minimum_stock

created_at

updated_at

categories

id

name

description

stock_transactions

id

product_id

transaction_type

quantity

previous_stock

new_stock

user_id

notes

created_at

audit_logs

id

user_id

action

record_type

record_id

created_at

17. Recommended Technology Stack

The research document does not specify a required programming language, framework, database, or deployment platform.

A suitable web-development stack would be:

Frontend

React

Next.js

Tailwind CSS

shadcn/ui

Backend

Node.js

Express.js

or

Next.js API routes

Database

PostgreSQL

Possible hosted platform:

Supabase

Authentication

Supabase Auth

or

Custom authentication using Node.js

Hosting

Vercel for frontend

Supabase for database and authentication

18. Hardware Requirements

Minimum hardware

Desktop or laptop computer

Barcode-scanning device

Possible barcode-scanning devices:

USB barcode scanner

Smartphone with camera

Recommended computer specifications

Dual-core or better processor

4 GB RAM minimum

8 GB RAM recommended

Internet connection for cloud-based deployment

Modern browser such as Chrome, Edge, or Firefox

Exact minimum PC specifications are not provided in the research document. These are practical implementation recommendations.

19. Software Requirements

For Users

Modern web browser

Internet or local network connection

Camera permission if phone-camera barcode scanning is used

For Development

Visual Studio Code

Node.js

npm

Git

GitHub

PostgreSQL / Supabase

Browser developer tools

20. Functional Requirements

The system should be able to:

Authenticate authorized users.

Register products.

Store product details.

Store existing product barcodes.

Generate barcodes for products without barcodes.

Scan barcodes.

Retrieve products using scanned barcodes.

Record stock-in transactions.

Increase inventory automatically after stock-in.

Record stock-out transactions.

Decrease inventory automatically after stock-out.

Prevent invalid inventory deductions.

Display current stock quantities.

Search and filter products.

Maintain transaction history.

Generate inventory reports.

Display inventory status.

Maintain accurate and updated inventory records.

21. Non-Functional Requirements

The system should be evaluated using the ISO/IEC 25010 model.

Relevant software quality characteristics include:

Functional Suitability

The system should correctly perform its intended inventory functions.

Performance Efficiency

Barcode scanning and inventory updates should respond quickly.

Compatibility

The system should work properly in supported browsers and devices.

Usability

The interface should be easy for grocery store personnel to understand and operate.

Reliability

Inventory records should remain accurate and available during normal system use.

Security

Only authorized users should have access to protected system functions and data.

Maintainability

The application should be structured so that bugs and future changes can be handled efficiently.

Portability

The web application should work across compatible computers, phones, and browsers.

22. Validation Requirements

The following validations are recommended:

Barcode must be unique.

Product name is required.

Stock-in quantity must be greater than zero.

Stock-out quantity must be greater than zero.

Stock-out quantity must not exceed available stock.

Duplicate products should be detected or prevented where appropriate.

Invalid barcodes should display a proper error message.

Unauthorized users should not access protected features.

23. Security Requirements

Recommended security features:

Secure authentication

Password hashing or managed authentication

Role-based access control

Protected API routes

Input validation

Database access restrictions

Session management

Audit logs

Regular backups

24. Backup Requirements

The system should have a way to protect inventory data.

Recommended options:

Automatic cloud database backups

Scheduled manual export

CSV or Excel inventory backup

Database backup before major system updates

25. User Interface Requirements

The application should be:

Responsive

Easy to understand

Mobile-friendly

Fast to navigate

Consistent in layout

Easy to use during barcode scanning

Recommended pages:

Login
│
├── Dashboard
│
├── Products
│   ├── Product List
│   ├── Add Product
│   └── Product Details
│
├── Barcode Scanner
│
├── Stock-In
│
├── Stock-Out
│
├── Inventory
│
├── Transactions
│
├── Reports
│
└── User Management

26. Suggested System Workflow

Product Registration

User
  ↓
Add Product
  ↓
Does product already have barcode?
  ├── Yes → Scan/Enter Existing Barcode
  │
  └── No → Generate New Barcode
  ↓
Save Product
  ↓
Product Added to Inventory Database

Stock-In

Scan Barcode
     ↓
Find Product
     ↓
Enter Quantity
     ↓
Confirm Stock-In
     ↓
Create Transaction
     ↓
Increase Inventory
     ↓
Display Updated Stock

Stock-Out

Scan Barcode
     ↓
Find Product
     ↓
Enter Quantity
     ↓
Check Available Stock
     ↓
Confirm Stock-Out
     ↓
Create Transaction
     ↓
Decrease Inventory
     ↓
Display Updated Stock

27. Project Scope

According to the research document, the system includes:

Product registration

Barcode generation

Barcode scanning

Automated stock updates

Inventory monitoring

Stock-in transactions

Stock-out transactions

Inventory reports

28. Project Limitations

The research document explicitly limits the project to inventory monitoring and stock management.

The following features are not required in the current scope:

Delivery tracking

Supplier management

Multi-warehouse management

Advanced warehouse management

Unless the researchers revise their study, these features should be treated as additional modules and not part of the original development price.

29. Features That Should Be Clarified Before Development

Before development starts, the client/researchers should confirm the following:

Users

How many user roles are needed?

Can cashiers modify product information?

Who can view reports?

Who can delete products?

Stock-Out

Is stock-out only manual inventory release?

Does stock-out represent actual customer sales?

Does the system need a POS module?

Barcode

Will a physical barcode scanner be used?

Will phone-camera scanning be required?

Which barcode formats should be supported?

Do generated barcodes need printable labels?

Reports

Which reports are required?

Is PDF export required?

Is Excel export required?

Are charts required?

Deployment

Will the system run online?

Will it run only inside the grocery store?

Is offline functionality required?

Inventory

Is low-stock notification required?

Are product expiration dates required?

Are units of measurement required?

Are product prices required?

30. Recommended MVP

For the first working version, prioritize:

Login

Dashboard

Product management

Category management

Barcode generation

Barcode scanning

Stock-in

Stock-out

Automatic stock updating

Inventory list

Transaction history

Basic reports

This version is enough to demonstrate the main concepts of the research project.

31. Optional Future Features

These should be considered additional scope:

Point-of-sale system

Supplier management

Purchase orders

Sales tracking

Expense tracking

Product expiration monitoring

SMS/email alerts

Low-stock notifications

Multi-branch support

Multi-warehouse support

Delivery tracking

Advanced analytics

Forecasting

QR code support

Offline synchronization

32. Development Priority

Phase 1 — Planning

Confirm requirements

Define user roles

Finalize database structure

Design wireframes

Phase 2 — Core Development

Authentication

Products

Categories

Inventory database

Phase 3 — Barcode Integration

Barcode generation

USB scanner support

Camera scanner support if required

Phase 4 — Inventory Transactions

Stock-in

Stock-out

Automatic stock updating

Transaction history

Phase 5 — Reports and Dashboard

Inventory reports

Dashboard

Low-stock display

Phase 6 — Testing

Functional testing

Barcode testing

Mobile/browser testing

User acceptance testing

ISO/IEC 25010 evaluation

Phase 7 — Deployment

Production database

Hosting

User setup

Data backup

Final documentation

33. Recommended Deliverables

At project completion, the client should receive:

Working Inventory Management System

Source code

Database schema

Database setup

Barcode-scanning functionality

Barcode-generation functionality

Inventory reports

User accounts

Deployment configuration

Basic user guide

System documentation

34. Final Minimum Requirement Checklist

Required

Login

Product registration

Product editing

Product search

Barcode storage

Barcode generation

Barcode scanning

Stock-in

Stock-out

Automatic stock increase

Automatic stock decrease

Inventory monitoring

Transaction history

Inventory reports

Responsive interface

Database

Error handling

Input validation

System testing

ISO/IEC 25010 evaluation

Recommended

Dashboard

Category management

User roles

Low-stock status

Out-of-stock status

Report filtering

PDF/Excel export

Audit logs

Backup system

Phone-camera barcode scanning

35. Important Scope Note

The project should remain focused on the requirements documented in the research paper.

Features such as:

POS

supplier management

delivery tracking

accounting

multi-branch support

multi-warehouse operations

advanced analytics

should not automatically be included in the original scope.

If these are later requested by the researchers, adviser, or panel, they should be treated as change requests or additional features because they can significantly increase development time and project cost.