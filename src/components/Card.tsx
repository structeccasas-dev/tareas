interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export function Card({ hoverable, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-2xl shadow-elevation-xs ${
        hoverable ? "transition-all duration-200 ease-out hover:shadow-elevation-sm hover:border-border-strong" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
