import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = { title: "Manage tournament" };

export default function Page() {
  return <AdminDashboard />;
}
