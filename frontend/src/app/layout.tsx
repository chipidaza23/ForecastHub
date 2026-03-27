import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "ForecastHub — Demand Forecasting Dashboard",
  description: "Open-source demand forecasting and inventory management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex bg-slate-50">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
