import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { cobPayments } from "@/db/schema/collectionsPayment"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getReceiptStream } from "@/lib/receiptStorage"

export async function GET(_request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { paymentId } = await params
  const [payment] = await db
    .select({ receiptUrl: cobPayments.receiptUrl })
    .from(cobPayments)
    .where(eq(cobPayments.id, paymentId))
    .limit(1)
  if (!payment?.receiptUrl) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const stream = await getReceiptStream(payment.receiptUrl)

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "image/jpeg",
      // El comprobante de un pago no se reemplaza una vez registrado.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
