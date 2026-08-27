interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface/75 px-6 py-5 backdrop-blur-md">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
