'use client'
import { Viewer, type PdfViewerProps, type DocumentViewerProps } from './PdfViewer.js'
import type { EngineAssets } from './document.js'

const engine: EngineAssets = {
  createWorker: () => new Worker(new URL('./engine/pdf.worker.mjs', import.meta.url), { type: 'module' }),
  getWasmUrl: () => new URL('./engine/hayro.wasm', import.meta.url).href,
}
export function PdfViewer(props: PdfViewerProps) {
  return <Viewer {...props} engine={engine} />
}
export function DocumentViewer(props: DocumentViewerProps) {
  return <Viewer {...props} engine={engine} acceptImages />
}
export type { DocumentViewerProps, DocumentViewerOptions, PdfViewerProps, PdfViewerOptions, PdfViewerTheme } from './PdfViewer.js'
export type { ViewerLabels } from './labels.js'
export type { ViewerRotation, ViewerZoom } from './pages.js'
export type { PdfSource } from './source.js'

