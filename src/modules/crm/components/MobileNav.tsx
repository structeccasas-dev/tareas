"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X, CheckSquare } from "lucide-react"
import type { SessionUserSummary, UserRole } from "@/types/users"
import { Sidebar } from "./Sidebar"

interface MobileNavProps {
  role: UserRole
  user: SessionUserSummary | null
  dueTasksCount?: number
}

export function MobileNav({ role, user, dueTasksCount = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer on navigation. Adjusting state during render (rather
  // than in an effect) avoids an extra commit and satisfies the compiler's
  // set-state-in-effect check — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  return (
    <>
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/75 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 flex-shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-600 transition-colors duration-150 hover:bg-black/[.04] active:bg-black/[.06]"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary shadow-elevation-xs">
          <CheckSquare className="w-3.5 h-3.5 text-white" strokeWidth={2} />
        </div>
        <span className="text-sm font-semibold text-gray-900 tracking-tight">Gestión de Tareas</span>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex h-full w-72 max-w-[80%] flex-col bg-sidebar shadow-elevation-lg"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-1 top-1.5 flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl text-gray-400 transition-colors duration-150 hover:bg-black/[.05] hover:text-gray-600 active:bg-black/[.07]"
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
              <Sidebar role={role} user={user} dueTasksCount={dueTasksCount} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
