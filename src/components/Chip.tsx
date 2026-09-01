interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  tone?: "neutral" | "primary"
}

export function Chip({ active, tone = "primary", className = "", children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        active
          ? tone === "primary"
            ? "bg-primary/10 text-primary-dark border-primary/20 hover:bg-primary/15"
            : "bg-black/[.06] text-gray-700 border-border-strong hover:bg-black/[.09]"
          : "bg-surface text-gray-400 border-border hover:border-border-strong hover:text-gray-600"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
