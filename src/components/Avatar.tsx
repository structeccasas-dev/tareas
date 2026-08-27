import { getInitials } from "@/lib/format"

type AvatarSize = "sm" | "md" | "lg"

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  indicator?: boolean
  className?: string
}

const SIZE_CLS: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
}

const INDICATOR_SIZE: Record<AvatarSize, string> = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-4 h-4",
}

export function Avatar({ name, src, size = "md", indicator, className = "" }: AvatarProps) {
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div
        className={`rounded-full bg-gradient-to-br from-gray-100 to-gray-200/80 border border-border flex items-center justify-center font-semibold text-gray-600 shadow-elevation-xs overflow-hidden ${SIZE_CLS[size]}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>
      {indicator && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-primary border-2 border-surface shadow-elevation-xs ${INDICATOR_SIZE[size]}`}
          title="Tiene tarea asignada"
        />
      )}
    </div>
  )
}
