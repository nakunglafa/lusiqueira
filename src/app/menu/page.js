import { getRestaurant } from "@/lib/api";
import { MenuClient } from "@/components/MenuClient";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "1";

export default async function MenuPage() {
  const data = await getRestaurant(RESTAURANT_ID);
  const restaurant = data?.restaurant ?? data?.data ?? null;
  const menusRaw = restaurant?.menus ?? data?.menus ?? [];
  const menus = Array.isArray(menusRaw) ? menusRaw : menusRaw ? [menusRaw] : [];

  return <MenuClient restaurant={restaurant} menus={menus} />;
}

