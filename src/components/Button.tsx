import { forwardRef } from "react"
import { Loader2 } from "lucide-react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
type ButtonSize = "sm" | "md"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-elevation-xs hover:bg-primary-hover hover:shadow-elevation-sm active:bg-primary-hover active:shadow-elevation-xs",
  secondary:
    "bg-surface text-gray-700 border border-border shadow-elevation-xs hover:bg-surface-alt hover:border-border-strong active:bg-surface-alt/80",
  danger:
    "bg-error text-white shadow-elevation-xs hover:bg-red-600 hover:shadow-elevation-sm active:bg-red-700",
  ghost: "bg-transparent text-gray-600 hover:bg-black/[.04] hover:text-gray-900 active:bg-black/[.06]",
}

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:shadow-none ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    )
  },
)
Button.displayName = "Button"
