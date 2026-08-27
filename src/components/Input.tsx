import { forwardRef } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  uiSize?: "sm" | "md"
}

const BASE_CLS =
  "w-full text-sm text-gray-900 bg-surface-alt/60 border border-border rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed"

const SIZE_CLS = {
  md: { icon: "pl-9 pr-4 py-2.5", plain: "px-3.5 py-2.5" },
  sm: { icon: "pl-8 pr-3 py-1.5 text-xs", plain: "px-2.5 py-1.5 text-xs" },
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, uiSize = "md", className = "", ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none [&>svg]:w-4 [&>svg]:h-4">
            {icon}
          </span>
          <input
            ref={ref}
            className={`${BASE_CLS} ${SIZE_CLS[uiSize].icon} ${className}`}
            {...props}
          />
        </div>
      )
    }
    return (
      <input ref={ref} className={`${BASE_CLS} ${SIZE_CLS[uiSize].plain} ${className}`} {...props} />
    )
  },
)
Input.displayName = "Input"
