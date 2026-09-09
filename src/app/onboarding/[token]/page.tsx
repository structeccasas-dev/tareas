import { getInvitationStatus } from "@/modules/personnel/data/queries"
import { OnboardingForm } from "@/modules/personnel/components/OnboardingForm"
import { Card } from "@/components/Card"

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Este enlace no existe.",
  used: "Este enlace ya fue utilizado.",
  expired: "Este enlace venció. Pedí que te generen uno nuevo.",
}

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const status = await getInvitationStatus(token)

  if (!status.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="p-8 max-w-sm w-full text-center">
          <h1 className="text-lg font-semibold text-gray-900">Enlace no disponible</h1>
          <p className="mt-1.5 text-sm text-gray-500">{ERROR_MESSAGES[status.reason]}</p>
        </Card>
      </div>
    )
  }

  return <OnboardingForm token={token} personnelName={status.personnelName} />
}
