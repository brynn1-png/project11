import { redirect } from "next/navigation";
import { InventoryApp } from "@/components/inventory-app";
import { InventoryProvider } from "@/components/inventory-provider";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInventorySnapshot } from "@/lib/inventory-data";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const inventory = await getInventorySnapshot(user.role);

  return (
    <InventoryProvider products={inventory.products} transactions={inventory.transactions}>
      <InventoryApp currentUser={user} users={inventory.users} dataError={inventory.error} />
    </InventoryProvider>
  );
}
