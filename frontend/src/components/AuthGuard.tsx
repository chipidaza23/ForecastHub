"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!supabase) return;
    if (loading) return;
    if (!session && !isLoginPage) {
      router.replace("/login");
    }
  }, [session, loading, isLoginPage, router]);

  // Auth disabled — render full layout
  if (!supabase) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </>
    );
  }

  // Still loading auth state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  // Login page — no sidebar
  if (isLoginPage) {
    return <main className="flex-1 overflow-auto">{children}</main>;
  }

  // Not authenticated — redirect in progress
  if (!session) {
    return null;
  }

  // Authenticated — full layout
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
