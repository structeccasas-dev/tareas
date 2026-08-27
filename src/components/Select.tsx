import { forwardRef } from "react"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  uiSize?: "sm" | "md"
}

const SIZE_CLS = {
  md: "px-3.5 py-2.5 text-sm",
  sm: "px-2.5 py-1.5 text-xs",
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ uiSize = "md", className = "", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full ${SIZE_CLS[uiSize]} text-gray-900 bg-surface-alt/60 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = "Select"
