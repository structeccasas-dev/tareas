"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: "md" | "lg"
}

const noopSubscribe = () => () => {}

// Renders on the client only — avoids an SSR/hydration mismatch from
// `document.body` not existing on the server.
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

export function Dialog({ open, onClose, title, children, size = "md" }: DialogProps) {
  const isClient = useIsClient()
  const isLarge = size === "lg"

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!isClient) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={
            isLarge
              ? "fixed inset-0 z-50 flex items-center justify-center sm:p-4"
              : "fixed inset-0 z-50 flex items-center justify-center p-4"
          }
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            className={
              isLarge
                ? "relative z-10 flex h-[100dvh] w-full flex-col overflow-y-auto border-border bg-surface/90 shadow-elevation-lg backdrop-blur-xl sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border"
                : "relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface/90 shadow-elevation-lg backdrop-blur-xl"
            }
          >
            <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-md">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-black/[.05] hover:text-gray-600"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
