import { Avatar } from "@/components/Avatar"
import { Card } from "@/components/Card"
import type { MemberOverview } from "@/types/dashboard"

interface MembersTableProps {
  members: MemberOverview[]
}

export function MembersTable({ members }: MembersTableProps) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Miembros</h2>
      {members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No hay miembros activos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Miembro</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Activas</th>
              <th className="text-right py-2 pl-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Finalizadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id} className="transition-colors duration-150 hover:bg-black/[.02]">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={member.name} size="sm" />
                    <span className="font-medium text-gray-900 truncate">{member.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right text-gray-700">{member.activeTasks}</td>
                <td className="py-2.5 pl-3 text-right text-gray-500">{member.doneTasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
