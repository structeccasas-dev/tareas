"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
}

interface Position {
  top: number
  left: number
  placement: "top" | "bottom"
}

// Se posiciona en `fixed` y se renderiza en un portal a `document.body` a
// propósito: los badges que la usan viven en tablas con `overflow-x-auto`,
// así que una tooltip `absolute` normal quedaba recortada por ese ancestro.
// El div externo hace el anclaje (transform estático, centrado + flip arriba/
// abajo) y el `motion.div` interno hace sólo la micro-animación de entrada,
// para que no compitan por la misma propiedad `transform`.
export function Tooltip({ content, children }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const placement = rect.top < 90 ? "bottom" : "top"
    setPosition({
      top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      placement,
    })
  }

  function hide() {
    setPosition(null)
  }

  return (
    <>
      <span ref={triggerRef} className="inline-flex cursor-pointer" onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {position && (
              <div
                className="pointer-events-none fixed z-50"
                style={{
                  top: position.top,
                  left: position.left,
                  transform: `translate(-50%, ${position.placement === "top" ? "-100%" : "0"})`,
                }}
              >
                <motion.div
                  role="tooltip"
                  initial={{ opacity: 0, y: position.placement === "top" ? 4 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: position.placement === "top" ? 4 : -4 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="relative w-max max-w-64 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-elevation-sm"
                >
                  {content}
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                      position.placement === "top" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900"
                    }`}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
