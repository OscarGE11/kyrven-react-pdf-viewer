'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { saveThemePreference, useViewerTheme, type PdfViewerTheme } from './theme.js'
import { mountPages } from './pages.js'
import { openPdf, type EngineAssets, type PdfSource } from './document.js'
import './viewer.css'

export type { PdfViewerTheme } from './theme.js'

export interface PdfViewerOptions {
  theme?: PdfViewerTheme
  accentColor?: string
  downloadName?: string
  layout?: 'single' | 'continuous'
  initialZoom?: number
  toolbar?: readonly ('page' | 'zoom' | 'settings' | 'download')[]
  maxCachedPages?: number
  maxFileBytes?: number
  maxPages?: number
  height?: string | number
}

export interface PdfViewerProps {
  src: PdfSource
  assetsUrl?: string
  options?: PdfViewerOptions
  onLoad?: (pageCount: number) => void
  onPageChange?: (page: number) => void
  onError?: (error: Error) => void
}

const defaultAccent = '#5262e8'
const themes = [
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
  ['system', 'Sistema'],
] as const

function normalizeColor(value: string | undefined) {
  const color = value?.trim().toLowerCase().replace(/^#/, '')
  if (!color || !/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color)) return undefined
  return '#' + (color.length === 3 ? color.replace(/./g, digit => digit.repeat(2)) : color)
}

const boundedZoom = (value: number) =>
  Number.isFinite(value) ? Math.max(0.25, Math.min(3, value)) : 1

export function PdfViewer({
  src,
  assetsUrl,
  engine,
  options,
  onLoad,
  onPageChange,
  onError,
}: PdfViewerProps & { engine?: EngineAssets }) {
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [download, setDownload] = useState<{ source: PdfSource; save: (name?: string) => void } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const view = useRef<ReturnType<typeof mountPages>>(null)
  const callbacks = useRef({ onLoad, onPageChange, onError })
  const pageInputId = useId()
  const settingsId = useId()
  const themeName = useId()
  const settingsButton = useRef<HTMLButtonElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const initialTheme = options?.theme ?? 'light'
  const accentColor = normalizeColor(options?.accentColor) ?? defaultAccent
  const { selectedTheme, theme } = useViewerTheme(initialTheme)
  const initialZoom = boundedZoom(options?.initialZoom ?? 1)
  const initialLayout = options?.layout ?? 'continuous'
  const [layout, setLayout] = useState(initialLayout)
  useEffect(() => setLayout(initialLayout), [initialLayout])
  const continuous = layout === 'continuous'
  const { maxFileBytes, maxPages } = options ?? {}
  const toolbar = options?.toolbar ?? ['page', 'zoom', 'settings', 'download']
  const requestedCache = options?.maxCachedPages ?? 6
  const cacheLimit = Number.isFinite(requestedCache)
    ? Math.min(6, Math.max(1, Math.floor(requestedCache)))
    : 6

  const display = useRef({ continuous, cacheLimit })
  useEffect(() => {
    display.current = { continuous, cacheLimit }
    view.current?.configure(continuous, cacheLimit)
  }, [continuous, cacheLimit])

  useEffect(() => {
    callbacks.current = { onLoad, onPageChange, onError }
  }, [onLoad, onPageChange, onError])

  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const abort = new AbortController()
    let close: (() => void) | undefined
    setError('')
    setPage(1)
    setCount(0)
    setDownload(null)
    setZoom(initialZoom)
    const fail = (reason: unknown) => {
      if (abort.signal.aborted) return
      const failure = reason instanceof Error ? reason : new Error(String(reason))
      setError(failure.message)
      callbacks.current.onError?.(failure)
    }
    void openPdf(src, assetsUrl ?? '/hayro/', abort.signal, maxFileBytes, maxPages, assetsUrl ? undefined : engine)
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
          (number) => {
            setPage(number)
            callbacks.current.onPageChange?.(number)
          },
          fail,
        )
        setCount(document.pageCount)
        setDownload({ source: src, save: document.save })
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
  }, [src, engine, assetsUrl, initialZoom, maxFileBytes, maxPages])

  function changeZoom(amount: number) {
    const updated = boundedZoom(zoom + amount)
    setZoom(updated)
    view.current?.setZoom(updated)
  }

  const style = theme === 'custom' ? { '--krpdf-accent': accentColor } as CSSProperties : undefined

  return (
    <section className="krpdf" data-theme={theme} style={style} aria-label="Visor PDF">
      {toolbar.length > 0 && (
        <div className="krpdf-toolbar" onKeyDown={event => {
          if (event.key !== 'Escape' || !settingsOpen) return
          event.stopPropagation()
          setSettingsOpen(false)
          settingsButton.current?.focus()
        }}>
          <div className="krpdf-controls">
            {toolbar.includes('page') && (
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
                  aria-label="Página anterior"
                >
                  <span className="krpdf-chevron krpdf-chevron-prev" aria-hidden="true" />
                </button>
                <label htmlFor={pageInputId}>Página</label>
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
                  aria-label="Página siguiente"
                >
                  <span className="krpdf-chevron" aria-hidden="true" />
                </button>
              </form>
            )}
            {toolbar.includes('zoom') && (
              <div className="krpdf-control-group" role="group" aria-label="Zoom">
                <button
                  type="button"
                  disabled={!count || zoom <= 0.25}
                  onClick={() => changeZoom(-0.25)}
                  aria-label="Reducir zoom"
                >
                  −
                </button>
                <span className="krpdf-zoom">{Math.round(zoom * 100)} %</span>
                <button
                  type="button"
                  disabled={!count || zoom >= 3}
                  onClick={() => changeZoom(0.25)}
                  aria-label="Aumentar zoom"
                >
                  +
                </button>
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
                    Descargar PDF
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
                    Opciones
                  </button>
                )}
              </div>
            )}
          </div>
          {toolbar.includes('settings') && (
            <div className="krpdf-settings" id={settingsId} hidden={!settingsOpen}>
              <label className="krpdf-field">
                Vista
                <select value={layout} onChange={event =>
                  setLayout(event.currentTarget.value === 'single' ? 'single' : 'continuous')
                }>
                  <option value="continuous">Scroll continuo</option>
                  <option value="single">Una página</option>
                </select>
              </label>
              {initialTheme !== 'custom' && (
                <fieldset className="krpdf-field">
                  <legend>Apariencia</legend>
                  <div className="krpdf-theme-options">
                    {themes.map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name={themeName}
                          value={value}
                          checked={selectedTheme === value}
                          onChange={() => saveThemePreference(value)}
                        />
                        <span>{label}</span>
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
          {error}
        </p>
      )}
      {!error && !count && (
        <p className="krpdf-message" role="status">
          Abriendo PDF…
        </p>
      )}
      <div
        ref={viewport}
        className="krpdf-viewport"
        style={{ height: options?.height }}
        tabIndex={0}
        aria-label="Páginas del PDF"
      />
    </section>
  )
}


