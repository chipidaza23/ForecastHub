import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthProvider from "@/components/AuthProvider";
import AuthGuard from "@/components/AuthGuard";

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
          <AuthGuard>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
