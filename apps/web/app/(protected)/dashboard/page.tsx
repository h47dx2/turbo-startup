import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/auth/dashboard-client";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@/lib/auth/constants";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const hasAccessToken = Boolean(cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value);
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value);

  if (!hasAccessToken && !hasRefreshToken) {
    redirect("/login");
  }

  return <DashboardClient />;
}
