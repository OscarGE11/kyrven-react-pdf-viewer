export type PdfSource = Blob | Uint8Array | string | URL

export function downloadName(source: PdfSource, extension: string, preferred?: string) {
  let name = preferred?.trim()
  if (!name && source instanceof File) name = source.name
  if (!name && (typeof source === 'string' || source instanceof URL)) {
    const url = new URL(source, document.baseURI)
    if (url.protocol !== 'blob:') {
      const segment = url.pathname.split('/').pop() ?? ''
      try {
        name = decodeURIComponent(segment)
      } catch {
        name = segment
      }
    }
  }
  const safeName = name?.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').trim().replace(/[. ]+$/, '') || 'documento'
  const lowerName = safeName.toLowerCase()
  const correctExtension = lowerName.endsWith('.' + extension) || (extension === 'jpg' && lowerName.endsWith('.jpeg'))
  return correctExtension ? safeName : `${safeName}.${extension}`
}

export function saveFile(file: Blob, name: string) {
  const link = document.createElement('a')
  link.download = name
  const url = URL.createObjectURL(file)
  link.href = url
  try {
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export async function readFile(source: PdfSource, maximum: number, signal: AbortSignal,
  subject = 'PDF',
): Promise<Blob> {
  signal.throwIfAborted()
  function check(size: number) {
    if (size > maximum) throw new Error(`El ${subject} supera el límite de bytes.`)
  }
  if (source instanceof Blob || source instanceof Uint8Array) {
    const size = source instanceof Blob ? source.size : source.byteLength
    check(size)
    if (!size) throw new Error(`El ${subject} está vacío.`)
    return source instanceof Blob ? source : new Blob([new Uint8Array(source)])
  }
  const url = new URL(source, document.baseURI)
  if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new Error(`URL de ${subject} no admitida.`)
  const download = new AbortController()
  const cancel = () => download.abort(signal.reason)
  signal.throwIfAborted()
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => download.abort(new Error(`Tiempo de descarga del ${subject} agotado.`)), 60_000)
  try {
    const response = await fetch(url, { signal: download.signal })
    if (!response.ok || !response.body) throw new Error(`No se pudo descargar el ${subject} (HTTP ${response.status}).`)
    check(Number(response.headers.get('content-length')))
    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let count = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        count += value.byteLength
        check(count)
        chunks.push(new Uint8Array(value))
      }
    } finally {
      reader.releaseLock()
    }
    if (!count) throw new Error(`El ${subject} está vacío.`)
    return new Blob(chunks, { type: response.headers.get('content-type')?.split(';')[0].trim() })
  } finally {
    clearTimeout(timer)
    download.abort()
    signal.removeEventListener('abort', cancel)
  }
}
