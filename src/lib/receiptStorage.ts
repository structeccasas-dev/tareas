import "server-only"
import { put, get, del } from "@vercel/blob"
import crypto from "crypto"
import sharp from "sharp"
import { getEnvPrefix } from "@/lib/personnelStorage"

// Comprobantes de pago: datos financieros de clientes, así que blobs privados
// (mismo criterio que los documentos de personal).
const BLOB_ACCESS = "private" as const

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

// Tope de peso del comprobante ya optimizado. Un comprobante es texto chico
// (monto, fecha, nº de operación) sobre fondo plano, así que casi siempre
// queda en 100-300KB; los pasos de abajo solo se recorren si una foto muy
// cargada no entra en el primer intento. Mismo valor que en el cliente
// (RECEIPT_MAX_BYTES en OperationDetailShell).
const RECEIPT_MAX_BYTES = 1024 * 1024
const COMPRESSION_STEPS: Array<{ dimension: number; quality: number }> = [
  { dimension: 1600, quality: 72 },
  { dimension: 1600, quality: 58 },
  { dimension: 1280, quality: 52 },
  { dimension: 1024, quality: 48 },
  { dimension: 800, quality: 42 },
  { dimension: 640, quality: 38 },
]

export async function saveReceipt(file: File): Promise<string> {
  const mimeType = file.type || "application/octet-stream"
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("El comprobante debe ser una imagen (JPG, PNG o WEBP).")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("El comprobante supera el tamaño máximo permitido (20MB).")
  }

  // Aunque el cliente ya comprime, se vuelve a procesar acá: no se puede
  // confiar en que el request venga de nuestro formulario, y sharp deja todo
  // normalizado (orientación aplicada, sin EXIF/GPS, tope de dimensión).
  const original = Buffer.from(await file.arrayBuffer())
  let buffer: Buffer | null = null
  for (const { dimension, quality } of COMPRESSION_STEPS) {
    buffer = await sharp(original)
      .rotate()
      .resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    if (buffer.byteLength <= RECEIPT_MAX_BYTES) break
  }
  if (!buffer || buffer.byteLength > RECEIPT_MAX_BYTES) {
    throw new Error("No se pudo reducir el comprobante a menos de 1MB. Probá con otra foto o una captura de pantalla.")
  }

  const blob = await put(`${getEnvPrefix()}/cobranzas/receipts/${crypto.randomUUID()}.jpg`, buffer, {
    access: BLOB_ACCESS,
    contentType: "image/jpeg",
  })
  return blob.url
}

export async function getReceiptStream(url: string): Promise<ReadableStream> {
  const result = await get(url, { access: BLOB_ACCESS })
  if (!result?.stream) throw new Error("Comprobante no encontrado")
  return result.stream
}

export async function deleteReceipt(url: string): Promise<void> {
  await del(url)
}
