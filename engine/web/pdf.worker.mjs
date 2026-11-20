let engine
const decoder = new TextDecoder()
const now = () => performance.timeOrigin + performance.now()

async function open({ file, limit, wasmUrl: resource }) {
  if (!file.size || file.size > 64 * 1024 * 1024) throw new Error('Tamaño de PDF fuera de límite.')
  const start = performance.now()
  const wasmUrl = new URL(resource)
  const [wasm, input] = await Promise.all([
    WebAssembly.instantiateStreaming(fetch(wasmUrl, { mode: 'same-origin', redirect: 'error' }), {})
      .then(({ instance }) => ({ engine: instance.exports, initMs: performance.now() - start })),
    file.arrayBuffer(),
  ])
  engine = wasm.engine
  const copyStart = performance.now()
  const offset = engine.pdf_allocate(input.byteLength)
  new Uint8Array(engine.memory.buffer, offset, input.byteLength).set(new Uint8Array(input))
  const inputCopyMs = performance.now() - copyStart
  const parseStart = performance.now()
  const pageCount = engine.pdf_open(limit)
  const parseMs = performance.now() - parseStart
  if (pageCount < 1) {
    throw new Error({
      '-1': 'PDF inválido o truncado.',
      '-2': 'Cantidad de páginas fuera de límite.',
      '-3': 'PDF cifrado o contraseña requerida.',
    }[pageCount] || 'No se pudo abrir el PDF.')
  }
  const { transferSize, encodedBodySize, decodedBodySize } =
    performance.getEntriesByName(wasmUrl.href).at(-1) ?? {}
  return { pageCount, metrics: {
    initMs: wasm.initMs, parseMs, inputCopyMs, transferSize, encodedBodySize, decodedBodySize,
    wasmMemory: engine.memory.buffer.byteLength,
  } }
}

function render({ number, scale }) {
  const start = performance.now()
  const dimensions = engine.pdf_render(number - 1, scale)
  const rasterMs = performance.now() - start
  if (!dimensions) throw new Error('Dimensiones o página fuera de límite.')
  const pixelWidth = dimensions & 0xffff
  const pixelHeight = dimensions >>> 16
  const copyStart = performance.now()
  const wasmPixels = new Uint8ClampedArray(
    engine.memory.buffer, engine.pixel_pointer(), pixelWidth * pixelHeight * 4,
  )
  // WASM memory cannot be transferred. The copied buffer is transferable.
  const pixels = wasmPixels.slice()
  const copyMs = performance.now() - copyStart
  engine.release_pixels()
  const warnings = decoder.decode(new Uint8Array(
    engine.memory.buffer, engine.warnings_pointer(), engine.warnings_length(),
  ))
  return {
    width: engine.pdf_width(), height: engine.pdf_height(), pixelWidth, pixelHeight, pixels,
    metrics: { number, rasterMs, copyMs, warnings, pixelBytes: pixels.byteLength,
      wasmMemory: engine.memory.buffer.byteLength, sentAt: now() },
  }
}

self.onmessage = async ({ data }) => {
  try {
    const result = data.kind === 'open' ? await open(data) : render(data)
    self.postMessage(result, result.pixels ? [result.pixels.buffer] : [])
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}


