"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store"
      });

      if (!mounted) {
        return;
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const payload = (await response.json()) as { user: User };
      setUser(payload.user);
      setLoading(false);
    }

    load().catch(() => {
      if (mounted) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: "{}"
    });

    router.replace("/login");
  }

  if (loading) {
    return <main>Loading...</main>;
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>ID: {user?.id}</p>
      <p>Email: {user?.email}</p>
      <p>Name: {user?.name ?? "-"}</p>
      <button onClick={logout}>Logout</button>
    </main>
  );
}
