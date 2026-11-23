'use client'
import { PdfViewer as Viewer, type PdfViewerProps } from './PdfViewer.js'
import type { EngineAssets } from './document.js'

const engine: EngineAssets = {
  createWorker: () => new Worker(new URL('./engine/pdf.worker.mjs', import.meta.url), { type: 'module' }),
  getWasmUrl: () => new URL('./engine/hayro.wasm', import.meta.url).href,
}
export function PdfViewer(props: PdfViewerProps) {
  return <Viewer {...props} engine={engine} />
}
export type { PdfViewerProps, PdfViewerOptions, PdfViewerTheme } from './PdfViewer.js'
export type { PdfSource } from './source.js'

