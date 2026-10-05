// Compresión de imágenes en el navegador, antes de armar el FormData de un
// Server Action. Vercel corta el request en ~4.5MB a nivel de plataforma, antes
// de que llegue a nuestro código (el bodySizeLimit de next.config.ts no puede
// overridear eso), y una foto de celular pesa 3-8MB. Además, subir menos bytes
// es más rápido en conexiones móviles.
export async function compressImage(
  file: File,
  {
    maxDimension = 1600,
    quality = 0.8,
    maxBytes,
  }: { maxDimension?: number; quality?: number; maxBytes?: number } = {},
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })

    const render = async (dimension: number, q: number): Promise<Blob | null> => {
      const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q))
    }

    // Con maxBytes, si el primer intento no entra se va bajando calidad y
    // dimensión de a pasos hasta que entre (o se agotan los pasos y se queda
    // con el más liviano logrado).
    const steps: Array<[number, number]> = [[maxDimension, quality]]
    if (maxBytes) {
      for (const [d, q] of [[1600, 0.6], [1280, 0.55], [1024, 0.5], [800, 0.45], [640, 0.4]]) {
        if (d <= maxDimension) steps.push([d, Math.min(q, quality)])
      }
    }

    let best: Blob | null = null
    for (const [dimension, q] of steps) {
      const blob = await render(dimension, q)
      if (!blob) continue
      if (!best || blob.size < best.size) best = blob
      if (!maxBytes || blob.size <= maxBytes) break
    }
    bitmap.close()

    // Si quedó más pesada que el original (una captura ya optimizada, por
    // ejemplo), mejor no empeorarla — salvo que el original no entre en el tope.
    if (!best || (best.size >= file.size && (!maxBytes || file.size <= maxBytes))) return file
    return new File([best], file.name.replace(/\.[^./]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    // Si el navegador no puede decodificar el formato (algunos HEIC en
    // Android, por ejemplo), mandamos el original y que lo valide el server.
    return file
  }
}
