import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ShopAccess } from "@/features/shops/shop-access";
import "./shops.css";

export default async function ShopsPage() {
  await connection();
  if(process.env.TENANT_SESSION_PREVIEW_ENABLED!=="true")notFound();
  return <ShopAccess/>;
}
