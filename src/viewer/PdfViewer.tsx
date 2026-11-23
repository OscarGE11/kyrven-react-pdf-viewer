'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { saveThemePreference, useViewerTheme, type PdfViewerTheme } from './theme.js'
import { mountPages, type ViewerZoom, type ViewerRotation } from './pages.js'
import { openPdf, type EngineAssets, type PdfSource } from './document.js'
import { openDocument } from './media.js'
import { defaultLabels, type ViewerLabels } from './labels.js'
import './viewer.css'

export type { PdfViewerTheme } from './theme.js'

export interface PdfViewerOptions {
  theme?: PdfViewerTheme
  rememberTheme?: boolean
  accentColor?: string
  downloadName?: string
  layout?: 'single' | 'continuous'
  initialZoom?: ViewerZoom
  initialRotation?: ViewerRotation
  toolbar?: readonly ('page' | 'zoom' | 'fit' | 'rotate' | 'settings' | 'download')[]
  maxCachedPages?: number
  maxFileBytes?: number
  maxPages?: number
  height?: string | number
}

export interface PdfViewerProps {
  src: PdfSource
  assetsUrl?: string
  options?: PdfViewerOptions
  labels?: ViewerLabels
  onLoad?: (pageCount: number) => void
  onPageChange?: (page: number) => void
  onError?: (error: Error) => void
}

const defaultAccent = '#5262e8'
export type DocumentViewerProps = PdfViewerProps
export type DocumentViewerOptions = PdfViewerOptions

const themes = ['light', 'dark', 'system'] as const

function normalizeColor(value: string | undefined) {
  const color = value?.trim().toLowerCase().replace(/^#/, '')
  if (!color || !/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color)) return undefined
  return '#' + (color.length === 3 ? color.replace(/./g, digit => digit.repeat(2)) : color)
}

const boundedZoom = (value: number) =>
  Number.isFinite(value) ? Math.max(0.25, Math.min(3, value)) : 1

export function Viewer({
  src,
  assetsUrl,
  engine,
  acceptImages = false,
  options,
  labels: overrides,
  onLoad,
  onPageChange,
  onError,
}: PdfViewerProps & { engine?: EngineAssets; acceptImages?: boolean }) {
  const labels = { ...defaultLabels, ...Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined),
  ) }
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState<Error | null>(null)
  const [download, setDownload] = useState<{
    source: PdfSource; kind: 'pdf' | 'image'; save: (name?: string) => void
  } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const view = useRef<ReturnType<typeof mountPages>>(null)
  const callbacks = useRef({ onLoad, onPageChange, onError })
  const pageInputId = useId()
  const settingsId = useId()
  const themeName = useId()
  const settingsButton = useRef<HTMLButtonElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const initialTheme = options?.theme ?? 'light'
  const rememberTheme = options?.rememberTheme ?? true
  const accentColor = normalizeColor(options?.accentColor) ?? defaultAccent
  const { selectedTheme, theme } = useViewerTheme(initialTheme, rememberTheme)
  const requestedZoom = options?.initialZoom ?? 1
  const initialZoom = typeof requestedZoom === 'number' ? boundedZoom(requestedZoom) : requestedZoom
  const initialRotation = options?.initialRotation ?? 0
  const initialLayout = options?.layout ?? 'continuous'
  const [layout, setLayout] = useState(initialLayout)
  useEffect(() => setLayout(initialLayout), [initialLayout])
  const [zoomMode, setZoomMode] = useState(initialZoom)
  const [rotation, setRotation] = useState(initialRotation)
  const continuous = layout === 'continuous'
  const { maxFileBytes, maxPages } = options ?? {}
  const toolbar = options?.toolbar ?? ['page', 'zoom', 'fit', 'rotate', 'settings', 'download']
  const requestedCache = options?.maxCachedPages ?? 6
  const cacheLimit = Number.isFinite(requestedCache)
    ? Math.min(6, Math.max(1, Math.floor(requestedCache)))
    : 6

  const display = useRef({ continuous, cacheLimit })
  const pageLabels = useRef({ page: labels.pageImage, image: labels.image })
  useEffect(() => {
    display.current = { continuous, cacheLimit }
    view.current?.configure(continuous, cacheLimit)
  }, [continuous, cacheLimit])

  useEffect(() => {
    pageLabels.current = { page: labels.pageImage, image: labels.image }
    view.current?.setLabels(pageLabels.current)
  }, [labels.pageImage, labels.image])

  useEffect(() => {
    callbacks.current = { onLoad, onPageChange, onError }
  }, [onLoad, onPageChange, onError])

  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const abort = new AbortController()
    let close: (() => void) | undefined
    setError(null)
    setPage(1)
    setCount(0)
    setDownload(null)
    setZoom(typeof initialZoom === 'number' ? initialZoom : 1)
    setZoomMode(initialZoom)
    setRotation(initialRotation)
    const fail = (reason: unknown) => {
      if (abort.signal.aborted) return
      const failure = reason instanceof Error ? reason : new Error(String(reason))
      setError(failure)
      callbacks.current.onError?.(failure)
    }
    const open = acceptImages ? openDocument : openPdf
    void open(src, assetsUrl ?? '/hayro/', abort.signal, maxFileBytes, maxPages, assetsUrl ? undefined : engine)
      .then((document) => {
        if (abort.signal.aborted) {
          document.close()
          return
        }
        close = document.close
        if (!document.pageCount) throw new Error('El documento no contiene páginas.')
        view.current = mountPages(
          node,
          document,
          display.current.continuous,
          display.current.cacheLimit,
          initialZoom,
          initialRotation,
          pageLabels.current,
          (number) => {
            setPage(number)
            callbacks.current.onPageChange?.(number)
          },
          setZoom,
          fail,
        )
        setCount(document.pageCount)
        setDownload({ source: src, kind: document.kind, save: document.save })
        callbacks.current.onLoad?.(document.pageCount)
        callbacks.current.onPageChange?.(1)
      })
      .catch(fail)
    return () => {
      abort.abort()
      view.current?.destroy()
      view.current = null
      close?.()
    }
  }, [src, acceptImages, engine, assetsUrl, initialZoom, initialRotation, maxFileBytes, maxPages])

  function changeZoom(amount: number) {
    changeZoomMode(boundedZoom(zoom + amount))
  }

  function changeZoomMode(mode: ViewerZoom) {
    setZoomMode(mode)
    view.current?.setView(mode, rotation)
  }

  function rotate(amount: 90 | -90) {
    const angle = ((rotation + amount + 360) % 360) as ViewerRotation
    setRotation(angle)
    view.current?.setView(zoomMode, angle)
  }

  const style = theme === 'custom' ? { '--krpdf-accent': accentColor } as CSSProperties : undefined

  return (
    <section className="krpdf" data-theme={theme} style={style}
      aria-label={acceptImages ? labels.documentViewer : labels.viewer}>
      {toolbar.length > 0 && (
        <div className="krpdf-toolbar" onKeyDown={event => {
          if (event.key !== 'Escape' || !settingsOpen) return
          event.stopPropagation()
          setSettingsOpen(false)
          settingsButton.current?.focus()
        }}>
          <div className="krpdf-controls">
            {toolbar.includes('page') && download?.kind !== 'image' && (
              <form className="krpdf-control-group"
                onSubmit={(event) => {
                  event.preventDefault()
                  const number = Number(new FormData(event.currentTarget).get('page'))
                  if (Number.isInteger(number) && number > 0) view.current?.goTo(number)
                }}
              >
                <button
                  type="button"
                  disabled={page <= 1 || !count}
                  onClick={() => view.current?.goTo(page - 1)}
                  aria-label={labels.previousPage}
                >
                  <span className="krpdf-chevron krpdf-chevron-prev" aria-hidden="true" />
                </button>
                <label htmlFor={pageInputId}>{labels.page}</label>
                <input
                  key={page}
                  id={pageInputId}
                  disabled={!count}
                  name="page"
                  type="number"
                  min={1}
                  max={count || 1}
                  defaultValue={page}
                />
                <span className="krpdf-page-count">/ {count || '—'}</span>
                <button
                  type="button"
                  disabled={page >= count}
                  onClick={() => view.current?.goTo(page + 1)}
                  aria-label={labels.nextPage}
                >
                  <span className="krpdf-chevron" aria-hidden="true" />
                </button>
              </form>
            )}
            {toolbar.includes('zoom') && (
              <div className="krpdf-control-group" role="group" aria-label={labels.zoom}>
                <button
                  type="button"
                  disabled={!count || zoom <= 0.25}
                  onClick={() => changeZoom(-0.25)}
                  aria-label={labels.zoomOut}
                >
                  −
                </button>
                <span className="krpdf-zoom">{Math.max(1, Math.round(zoom * 100))} %</span>
                <button
                  type="button"
                  disabled={!count || zoom >= 3}
                  onClick={() => changeZoom(0.25)}
                  aria-label={labels.zoomIn}
                >
                  +
                </button>
              </div>
            )}
            {toolbar.includes('fit') && (
              <div className="krpdf-control-group krpdf-fit">
                <button type="button" disabled={!count} aria-pressed={zoomMode === 'fit-width'}
                  onClick={() => changeZoomMode('fit-width')}>{labels.fitWidth}</button>
                <button type="button" disabled={!count} aria-pressed={zoomMode === 'fit-page'}
                  onClick={() => changeZoomMode('fit-page')}>{labels.fitPage}</button>
              </div>
            )}
            {toolbar.includes('rotate') && (
              <div className="krpdf-control-group" role="group" aria-label={labels.rotate}>
                <button type="button" disabled={!count} aria-label={labels.rotateLeft}
                  title={labels.rotateLeft} onClick={() => rotate(-90)}>↶</button>
                <button type="button" disabled={!count} aria-label={labels.rotateRight}
                  title={labels.rotateRight} onClick={() => rotate(90)}>↷</button>
              </div>
            )}
            {(toolbar.includes('settings') || toolbar.includes('download')) && (
              <div className="krpdf-actions">
                {toolbar.includes('download') && (
                  <button
                    className="krpdf-download-button"
                    type="button"
                    disabled={download?.source !== src}
                    onClick={() => download?.save(options?.downloadName)}
                  >
                    <span className="krpdf-download-icon" aria-hidden="true" />
                    {download?.kind === 'image' ? labels.downloadImage : labels.downloadPdf}
                  </button>
                )}
                {toolbar.includes('settings') && (
                  <button
                    className="krpdf-settings-button"
                    type="button"
                    ref={settingsButton}
                    aria-expanded={settingsOpen}
                    aria-controls={settingsId}
                    onClick={() => setSettingsOpen(open => !open)}
                  >
                    <span className="krpdf-gear" aria-hidden="true">⚙︎</span>
                    {labels.settings}
                  </button>
                )}
              </div>
            )}
          </div>
          {toolbar.includes('settings') && (
            <div className="krpdf-settings" id={settingsId} hidden={!settingsOpen}>
              <label className="krpdf-field">
                {labels.layout}
                <select value={layout} onChange={event =>
                  setLayout(event.currentTarget.value === 'single' ? 'single' : 'continuous')
                }>
                  <option value="continuous">{labels.continuous}</option>
                  <option value="single">{labels.single}</option>
                </select>
              </label>
              {initialTheme !== 'custom' && rememberTheme && (
                <fieldset className="krpdf-field">
                  <legend>{labels.appearance}</legend>
                  <div className="krpdf-theme-options">
                    {themes.map(value => (
                      <label key={value}>
                        <input
                          type="radio"
                          name={themeName}
                          value={value}
                          checked={selectedTheme === value}
                          onChange={() => saveThemePreference(value)}
                        />
                        <span>{labels[value]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="krpdf-message" role="alert">
          {labels.error(error)}
        </p>
      )}
      {!error && !count && (
        <p className="krpdf-message" role="status">
          {acceptImages ? labels.openingDocument : labels.openingPdf}
        </p>
      )}
      <div
        ref={viewport}
        className="krpdf-viewport"
        style={{ height: options?.height }}
        tabIndex={0}
        aria-label={acceptImages ? labels.documentViewport : labels.viewport}
      />
    </section>
  )
}


