import { describe, expect, it } from "vitest";
import { formatRole, hasPermission } from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("allows administrators to manage users", () => {
    expect(hasPermission("administrator", "users:manage")).toBe(true);
  });

  it("prevents managers and cashiers from managing users", () => {
    expect(hasPermission("manager", "users:manage")).toBe(false);
    expect(hasPermission("cashier", "users:manage")).toBe(false);
  });

  it("limits cost reports to administrators and managers", () => {
    expect(hasPermission("administrator", "reports:view_costs")).toBe(true);
    expect(hasPermission("manager", "reports:view_costs")).toBe(true);
    expect(hasPermission("inventory_staff", "reports:view_costs")).toBe(false);
    expect(hasPermission("cashier", "reports:view_costs")).toBe(false);
  });

  it("separates personal sales reports from organization-wide reports", () => {
    expect(hasPermission("administrator", "reports:view_sales_all")).toBe(true);
    expect(hasPermission("manager", "reports:view_sales_all")).toBe(true);
    expect(hasPermission("inventory_staff", "reports:view_sales_all")).toBe(false);
    expect(hasPermission("cashier", "reports:view_sales_all")).toBe(false);
    expect(hasPermission("inventory_staff", "reports:view_sales_own")).toBe(true);
    expect(hasPermission("cashier", "reports:view_sales_own")).toBe(true);
  });

  it("keeps inventory reports away from cashiers", () => {
    expect(hasPermission("administrator", "reports:view_inventory")).toBe(true);
    expect(hasPermission("manager", "reports:view_inventory")).toBe(true);
    expect(hasPermission("inventory_staff", "reports:view_inventory")).toBe(true);
    expect(hasPermission("cashier", "reports:view_inventory")).toBe(false);
  });

  it("gives every role its own history but limits organization-wide history", () => {
    expect(hasPermission("cashier", "transactions:view_own")).toBe(true);
    expect(hasPermission("cashier", "transactions:view_all")).toBe(false);
    expect(hasPermission("inventory_staff", "transactions:view_all")).toBe(true);
  });

  it("limits sales verification to administrators and managers", () => {
    expect(hasPermission("administrator", "sales:verify")).toBe(true);
    expect(hasPermission("manager", "sales:verify")).toBe(true);
    expect(hasPermission("inventory_staff", "sales:verify")).toBe(false);
    expect(hasPermission("cashier", "sales:verify")).toBe(false);
  });

  it("limits product management to administrators and managers", () => {
    expect(hasPermission("administrator", "products:manage")).toBe(true);
    expect(hasPermission("manager", "products:manage")).toBe(true);
    expect(hasPermission("inventory_staff", "products:manage")).toBe(false);
    expect(hasPermission("cashier", "products:manage")).toBe(false);
  });

  it("limits permanent product deletion to administrators", () => {
    expect(hasPermission("administrator", "products:delete")).toBe(true);
    expect(hasPermission("manager", "products:delete")).toBe(false);
    expect(hasPermission("inventory_staff", "products:delete")).toBe(false);
    expect(hasPermission("cashier", "products:delete")).toBe(false);
  });

  it("allows inventory staff to receive stock without managing products", () => {
    expect(hasPermission("inventory_staff", "stock:receive")).toBe(true);
    expect(hasPermission("cashier", "stock:receive")).toBe(false);
  });

  it("formats the inventory staff role for display", () => {
    expect(formatRole("inventory_staff")).toBe("Inventory Staff");
  });
});
