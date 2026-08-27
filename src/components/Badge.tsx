export type BadgeTone = "neutral" | "primary" | "info" | "success" | "warning" | "error"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  dot?: boolean
}

const TONE_CLS: Record<BadgeTone, string> = {
  neutral: "bg-black/[.045] text-gray-600",
  primary: "bg-primary/10 text-primary-dark",
  info: "bg-blue-500/10 text-blue-700",
  success: "bg-green-500/10 text-green-700",
  warning: "bg-amber-500/10 text-amber-700",
  error: "bg-red-500/10 text-red-700",
}

const DOT_CLS: Record<BadgeTone, string> = {
  neutral: "bg-gray-400",
  primary: "bg-primary",
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
}

export function Badge({
  tone = "neutral",
  dot,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium tracking-tight ${TONE_CLS[tone]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLS[tone]}`} />}
      {children}
    </span>
  )
}
