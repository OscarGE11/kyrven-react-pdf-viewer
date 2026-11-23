'use client'
import { Viewer, type PdfViewerProps, type DocumentViewerProps } from './PdfViewer.js'

export function PdfViewer(props: PdfViewerProps) {
  return <Viewer {...props} />
}
export function DocumentViewer(props: DocumentViewerProps) {
  return <Viewer {...props} acceptImages />
}
export type { DocumentViewerProps, DocumentViewerOptions, PdfViewerProps, PdfViewerOptions, PdfViewerTheme } from './PdfViewer.js'
export type { ViewerLabels } from './labels.js'
export type { ViewerRotation, ViewerZoom } from './pages.js'
export type { PdfSource } from './source.js'
