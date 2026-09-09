import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"
import { getDocumentFile } from "@/modules/personnel/data/queries"
import { getPersonnelFileStream } from "@/lib/personnelStorage"

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession()
  if (!session || !canManageUsers(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { documentId } = await params
  const doc = await getDocumentFile(documentId)
  if (!doc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const stream = await getPersonnelFileStream(doc.storedPath)

  return new NextResponse(stream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": doc.size,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      // El contenido de un documento es inmutable una vez subido (reemplazarlo
      // crea una fila y un blob nuevos), así que se puede cachear de forma
      // privada por tiempo indefinido en vez de volver a bajarlo cada vez.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
