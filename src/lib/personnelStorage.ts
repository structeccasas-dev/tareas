import "server-only"
import { put, get, del, list } from "@vercel/blob"
import crypto from "crypto"
import sharp from "sharp"

// Documentos de personal (fotos de carnet, contratos firmados): datos
// personales, así que se guardan como blobs privados (requieren el
// read-write token para leerse) en vez de públicos.
const BLOB_ACCESS = "private" as const

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
// Tope de entrada antes de procesar — por debajo del límite de 25MB de los
// Server Actions (ver next.config.ts) para poder devolver un error claro en
// vez de que el body se corte a mitad de camino.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

// Lado más largo tras redimensionar — de sobra para leer un carnet o firma
// en pantalla; las fotos de cámara de celular llegan a 3000-4000px y varios
// MB, así que esto reduce el peso drásticamente sin perder legibilidad.
const IMAGE_MAX_DIMENSION = 1600
const IMAGE_QUALITY = 80

// Un solo Blob store para todos los ambientes: los archivos se separan por
// carpeta ("dev/" o "production/") en vez de usar stores distintos.
// VERCEL_ENV solo viene seteada en Vercel ("production" | "preview" |
// "development"); localmente no existe, así que cualquier caso que no sea
// producción cae en "dev".
function getEnvPrefix(): "dev" | "production" {
  return process.env.VERCEL_ENV === "production" ? "production" : "dev"
}

function withJpegExtension(fileName: string): string {
  return `${fileName.replace(/\.[^./]+$/, "")}.jpg`
}

async function prepareContent(
  file: File,
  mimeType: string,
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const original = Buffer.from(await file.arrayBuffer())
  if (!mimeType.startsWith("image/")) {
    return { buffer: original, contentType: mimeType, fileName: file.name }
  }

  const resized = await sharp(original)
    .rotate() // respeta el EXIF de orientación antes de tirar los metadatos
    .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: IMAGE_QUALITY })
    .toBuffer()

  return { buffer: resized, contentType: "image/jpeg", fileName: withJpegExtension(file.name) }
}

export async function savePersonnelFile(
  personnelId: string,
  file: File,
): Promise<{ storedPath: string; fileName: string; mimeType: string; size: number }> {
  const mimeType = file.type || "application/octet-stream"
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Tipo de archivo no permitido. Subí una imagen (JPG, PNG, WEBP) o un PDF.")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("El archivo supera el tamaño máximo permitido (20MB).")
  }

  const { buffer, contentType, fileName } = await prepareContent(file, mimeType)

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "archivo"
  const pathname = `${getEnvPrefix()}/personnel/${personnelId}/${crypto.randomUUID()}-${safeName}`

  const blob = await put(pathname, buffer, {
    access: BLOB_ACCESS,
    contentType,
  })

  return {
    storedPath: blob.url,
    fileName,
    mimeType: contentType,
    size: buffer.byteLength,
  }
}

export async function getPersonnelFileStream(storedPath: string): Promise<ReadableStream> {
  const result = await get(storedPath, { access: BLOB_ACCESS })
  if (!result?.stream) throw new Error("Archivo no encontrado")
  return result.stream
}

export async function deletePersonnelFiles(personnelId: string): Promise<void> {
  const { blobs } = await list({ prefix: `${getEnvPrefix()}/personnel/${personnelId}/` })
  if (blobs.length > 0) await del(blobs.map((b) => b.url))
}

export async function deletePersonnelFile(storedPath: string): Promise<void> {
  await del(storedPath)
}
