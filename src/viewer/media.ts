import { fileLimit, openPdf, type EngineAssets, type ViewerDocument } from './document.js'
import { downloadName, readFile, saveFile, type PdfSource } from './source.js'

const imageTypes = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const
type ImageType = keyof typeof imageTypes

async function detectType(file: Blob): Promise<'pdf' | ImageType> {
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const header = new TextDecoder('latin1').decode(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes[0] === 0x89 && header.slice(1, 8) === 'PNG\r\n\x1a\n') return 'png'
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif'
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'webp'
  if (header.includes('%PDF-') || file.type === 'application/pdf') return 'pdf'
  for (const extension of Object.keys(imageTypes) as ImageType[]) {
    if (file.type === imageTypes[extension]) return extension
  }
  throw new Error('Formato no admitido. Usa PDF, JPG, PNG, WebP o GIF.')
}

async function openImage(source: PdfSource, file: Blob, type: ImageType, signal: AbortSignal): Promise<ViewerDocument> {
  const image = file.type === imageTypes[type] ? file : file.slice(0, file.size, imageTypes[type])
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' })
  if (signal.aborted) {
    bitmap.close()
    signal.throwIfAborted()
  }
  const { width, height } = bitmap
  const size = { width, height }
  let closed = false
  return {
    kind: 'image',
    pageCount: 1,
    firstPageSize: size,
    async render(_number, zoom, abort) {
      abort.throwIfAborted()
      if (closed) throw new DOMException('Documento cerrado.', 'AbortError')
      const scale = Math.min(zoom * (window.devicePixelRatio || 1), 4096 / width, 4096 / height,
        Math.sqrt(4_000_000 / (width * height)))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(width * scale))
      canvas.height = Math.max(1, Math.floor(height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas 2D no disponible.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return { ...size, canvas }
    },
    save(name) {
      if (!closed) saveFile(image, downloadName(source, type, name))
    },
    close() {
      closed = true
      bitmap.close()
    },
  }
}

export async function openDocument(source: PdfSource, assetsUrl: string, signal: AbortSignal,
  maxFileBytes?: number, maxPages?: number, engine?: EngineAssets,
) {
  const file = await readFile(source, fileLimit(maxFileBytes), signal, 'archivo')
  const type = await detectType(file)
  signal.throwIfAborted()
  return type === 'pdf'
    ? openPdf(source, assetsUrl, signal, maxFileBytes, maxPages, engine, file)
    : openImage(source, file, type, signal)
}
