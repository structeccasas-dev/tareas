"use client"

import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

const STORAGE_KEY = "sidebar-collapsed"

interface DesktopSidebarShellProps {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function DesktopSidebarShell({ sidebar, children }: DesktopSidebarShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    setMounted(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden md:flex flex-col bg-sidebar shadow-[1px_0_0_rgba(0,0,0,.04),4px_0_16px_rgba(17,24,39,.03)] overflow-hidden print:hidden ${
          mounted ? "transition-[width] duration-200 ease-out" : ""
        } ${collapsed ? "w-0" : "w-60"}`}
      >
        <div className="w-60 h-full flex-shrink-0">{sidebar}</div>
      </aside>
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Mostrar menú" : "Ocultar menú"}
        className={`fixed z-40 hidden md:flex items-center justify-center w-6 h-6 rounded-full border border-border bg-surface text-gray-500 shadow-elevation-xs hover:text-gray-900 hover:bg-black/[.035] print:hidden ${
          mounted ? "transition-[left] duration-200 ease-out" : ""
        } ${collapsed ? "left-2" : "left-[14.5rem]"}`}
        style={{ top: "5rem" }}
      >
        {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" strokeWidth={2} /> : <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={2} />}
      </button>
      <main className={`print:pl-0 bg-bg min-h-dvh ${mounted ? "transition-[padding] duration-200 ease-out" : ""} ${collapsed ? "md:pl-0" : "md:pl-60"}`}>
        {children}
      </main>
    </>
  )
}
