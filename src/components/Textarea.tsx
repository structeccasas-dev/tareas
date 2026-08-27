import { forwardRef } from "react"

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full px-3.5 py-2.5 text-sm text-gray-900 bg-surface-alt/60 border border-border rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all duration-200 ease-out resize-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    )
  },
)
Textarea.displayName = "Textarea"
