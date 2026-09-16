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

  it("allows inventory staff to receive stock without managing products", () => {
    expect(hasPermission("inventory_staff", "stock:receive")).toBe(true);
    expect(hasPermission("cashier", "stock:receive")).toBe(false);
  });

  it("formats the inventory staff role for display", () => {
    expect(formatRole("inventory_staff")).toBe("Inventory Staff");
  });
});
