"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Package, Bell, Sparkles, Upload, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: BarChart2 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/ask", label: "AI Advisor", icon: Sparkles },
  { href: "/upload", label: "Upload Data", icon: Upload },
];

function NavItems({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={() => setOpen(true)} className="p-1 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <Logo />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <Logo />
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <NavItems onNav={() => setOpen(false)} />
            <Footer />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen">
        <div className="px-4 py-5 border-b border-gray-100">
          <Logo />
        </div>
        <NavItems />
        <Footer />
      </aside>
    </>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
        <BarChart2 className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm font-bold text-gray-900">ForecastHub</span>
    </div>
  );
}

function Footer() {
  return (
    <div className="px-4 py-4 border-t border-gray-100 mt-auto">
      <p className="text-xs text-gray-400">ForecastHub v0.1.0</p>
      <p className="text-xs text-gray-400">Open-source · MIT</p>
    </div>
  );
}
