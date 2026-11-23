import { pdfDownloadName, readPdf, type PdfSource } from './source.js'
export type { PdfSource } from './source.js'
export type EngineAssets = { createWorker: () => Worker; getWasmUrl: () => string }

const MiB = 1024 * 1024
const deadline = 30_000
type OpenReply = { pageCount: number; metrics: object }
type RenderReply = {
  width: number; height: number; pixelWidth: number; pixelHeight: number
  pixels: Uint8ClampedArray<ArrayBuffer>
  metrics: { sentAt: number; warnings: string }
}

function bounded(value: number | undefined, maximum: number) {
  if (value === undefined) return maximum
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('El límite debe ser un entero positivo.')
  return Math.min(value, maximum)
}

function sameOriginAsset(url: URL) {
  if (url.origin !== location.origin || !['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Los recursos del motor deben servirse desde el mismo origen.')
  }
  return url
}

function staticEngine(assetsUrl: string): EngineAssets {
  const base = new URL(assetsUrl.replace(/\/?$/, '/'), document.baseURI)
  const workerUrl = sameOriginAsset(new URL('pdf.worker.mjs', base))
  return {
    createWorker: () => new Worker(workerUrl, { type: 'module' }),
    getWasmUrl: () => new URL('hayro.wasm', base).href,
  }
}

export async function openPdf(source: PdfSource, assetsUrl: string, signal: AbortSignal,
  maxFileBytes?: number, maxPages?: number, engine?: EngineAssets) {
  signal.throwIfAborted()
  const limit = bounded(maxPages, 2000)
  const assets = engine ?? staticEngine(assetsUrl)
  const wasm = sameOriginAsset(new URL(assets.getWasmUrl(), document.baseURI))
  let file: Blob | undefined = await readPdf(source, bounded(maxFileBytes, 64 * MiB), signal)
  signal.throwIfAborted()
  let worker: Worker | undefined
  let pending: ((error: unknown) => void) | undefined
  let closed = false

  function stop(error: unknown) {
    worker?.terminate()
    worker = undefined
    pending?.(error)
  }

  function close() {
    closed = true
    file = undefined
    stop(new DOMException('Documento cerrado.', 'AbortError'))
    signal.removeEventListener('abort', close)
  }
  signal.addEventListener('abort', close, { once: true })

  function request<T>(payload: object, expires: number, abort?: AbortSignal): Promise<T> {
    if (closed) throw new DOMException('Documento cerrado.', 'AbortError')
    abort?.throwIfAborted()
    if (pending) throw new Error('Hay una operación PDF en curso.')
    const port = worker ??= assets.createWorker()
    return new Promise((resolve, reject) => {
      const interrupted = () => stop(abort?.reason)
      const timer = setTimeout(() => stop(new Error('El motor PDF superó los 30 segundos.')),
        Math.max(0, expires - performance.now()))
      function cleanup() {
        clearTimeout(timer)
        abort?.removeEventListener('abort', interrupted)
        port.onmessage = port.onerror = port.onmessageerror = null
        pending = undefined
      }
      pending = error => {
        cleanup()
        reject(error)
      }
      abort?.addEventListener('abort', interrupted, { once: true })
      port.onerror = event => {
        event.preventDefault()
        stop(new Error('No se pudo ejecutar el worker de Hayro.'))
      }
      port.onmessageerror = () => stop(new Error('Respuesta del worker ilegible.'))
      port.onmessage = ({ data }) => {
        cleanup()
        if (data.error) reject(new Error(data.error))
        else resolve(data as T)
      }
      try {
        port.postMessage(payload)
      } catch (error) {
        stop(error)
      }
    })
  }

  async function open(expires: number, abort?: AbortSignal) {
    const start = performance.now()
    const result = await request<OpenReply>({ kind: 'open', file, limit, wasmUrl: wasm.href }, expires, abort)
    performance.measure('hayro:open', { start, end: performance.now(), detail: result.metrics })
    return result.pageCount
  }

  try {
    const pageCount = await open(performance.now() + deadline)
    let rendering = false
    async function render(number: number, zoom: number, abort: AbortSignal) {
      if (!Number.isInteger(number) || number < 1 || number > pageCount) throw new Error('Página fuera de rango.')
      if (rendering) throw new Error('Ya hay un render en curso.')
      rendering = true
      const start = performance.now()
      const end = start + deadline
      try {
        if (!worker) await open(end, abort)
        const result = await request<RenderReply>({
          kind: 'render', number, scale: zoom * (window.devicePixelRatio || 1),
        }, end, abort)
        const drawStart = performance.now()
        const canvas = document.createElement('canvas')
        canvas.width = result.pixelWidth
        canvas.height = result.pixelHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D no disponible.')
        context.putImageData(new ImageData(result.pixels, canvas.width, canvas.height), 0, 0)
        canvas.setAttribute('role', 'img')
        canvas.setAttribute('aria-label', `Página ${number}`)
        const drawn = performance.now()
        performance.measure('hayro:render', { start, end: drawn, detail: {
          ...result.metrics, drawMs: drawn - drawStart,
          receiveMs: Math.max(0, performance.timeOrigin + drawStart - result.metrics.sentAt),
        } })
        return { canvas, width: result.width, height: result.height }
      } finally {
        rendering = false
      }
    }
    function save(name?: string) {
      if (!file) return
      const link = document.createElement('a')
      link.download = pdfDownloadName(source, name)
      const downloadUrl = URL.createObjectURL(file)
      link.href = downloadUrl
      try {
        document.body.append(link)
        link.click()
      } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000)
      }
    }
    return { pageCount, render, save, close }
  } catch (error) {
    close()
    throw error
  }
}


