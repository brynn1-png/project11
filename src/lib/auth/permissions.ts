export const APP_ROLES = ["administrator", "manager", "inventory_staff", "cashier"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Permission =
  | "dashboard:view"
  | "products:view"
  | "products:manage"
  | "products:archive"
  | "products:delete"
  | "stock:receive"
  | "sales:record"
  | "sales:verify"
  | "adjustments:manage"
  | "transactions:view_own"
  | "transactions:view_all"
  | "reports:view_sales_own"
  | "reports:view_sales_all"
  | "reports:view_inventory"
  | "reports:view_costs"
  | "users:manage";

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  administrator: new Set([
    "dashboard:view", "products:view", "products:manage", "products:archive", "products:delete",
    "stock:receive", "sales:record", "sales:verify", "adjustments:manage", "transactions:view_own", "transactions:view_all",
    "reports:view_sales_own", "reports:view_sales_all", "reports:view_inventory", "reports:view_costs", "users:manage",
  ]),
  manager: new Set([
    "dashboard:view", "products:view", "products:manage", "products:archive",
    "stock:receive", "sales:record", "sales:verify", "adjustments:manage", "transactions:view_own", "transactions:view_all",
    "reports:view_sales_own", "reports:view_sales_all", "reports:view_inventory", "reports:view_costs",
  ]),
  inventory_staff: new Set([
    "dashboard:view", "products:view", "stock:receive",
    "sales:record", "transactions:view_own", "transactions:view_all",
    "reports:view_sales_own", "reports:view_inventory",
  ]),
  cashier: new Set(["dashboard:view", "products:view", "sales:record", "transactions:view_own", "reports:view_sales_own"]),
};

export function hasPermission(role: AppRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function formatRole(role: AppRole) {
  return role === "inventory_staff"
    ? "Inventory Staff"
    : role.charAt(0).toUpperCase() + role.slice(1);
}
