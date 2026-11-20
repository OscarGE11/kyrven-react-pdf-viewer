'use client'
import { PdfViewer as Viewer, type PdfViewerProps } from './PdfViewer.js'
const workerUrl = new URL('@kyrven/react-pdf-viewer/pdf.worker.mjs?no-inline', import.meta.url).href
const wasmUrl = new URL('@kyrven/react-pdf-viewer/hayro.wasm', import.meta.url).href

const engine = { workerUrl, wasmUrl }
export function PdfViewer(props: PdfViewerProps) {
  return <Viewer {...props} engine={engine} />
}
export type { PdfViewerProps, PdfViewerOptions } from './PdfViewer.js'
export type { PdfSource } from './source.js'

