'use client'
import { PdfViewer as Viewer, type PdfViewerProps } from './PdfViewer.js'
// The private alias lets Vite externalize the worker during dependency optimization.
import workerUrl from '#hayro-worker.txt?url&no-inline'
import wasmUrl from './engine/hayro.wasm?url&no-inline'

const engine = { workerUrl, wasmUrl }
export function PdfViewer(props: PdfViewerProps) {
  return <Viewer {...props} engine={engine} />
}
export type { PdfViewerProps, PdfViewerOptions, PdfViewerTheme } from './PdfViewer.js'
export type { PdfSource } from './source.js'

