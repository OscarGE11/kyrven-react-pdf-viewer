'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { mountPages } from './pages.js'
import { openPdf, type EngineAssets, type PdfSource } from './document.js'
import './viewer.css'

export interface PdfViewerOptions {
  layout?: 'single' | 'continuous'
  initialZoom?: number
  toolbar?: readonly ('page' | 'zoom' | 'settings')[]
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
  const viewport = useRef<HTMLDivElement>(null)
  const view = useRef<ReturnType<typeof mountPages>>(null)
  const callbacks = useRef({ onLoad, onPageChange, onError })
  const pageInputId = useId()
  const initialZoom = boundedZoom(options?.initialZoom ?? 1)
  const initialLayout = options?.layout ?? 'continuous'
  const [layout, setLayout] = useState(initialLayout)
  useEffect(() => setLayout(initialLayout), [initialLayout])
  const continuous = layout === 'continuous'
  const { maxFileBytes, maxPages } = options ?? {}
  const toolbar = options?.toolbar ?? ['page', 'zoom', 'settings']
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

  return (
    <section className="krpdf" aria-label="Visor PDF">
      {toolbar.length > 0 && (
        <div className="krpdf-controls">
          {toolbar.includes('page') && (
            <form
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
                ‹
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
              <span>/ {count || '—'}</span>
              <button
                type="button"
                disabled={page >= count}
                onClick={() => view.current?.goTo(page + 1)}
                aria-label="Página siguiente"
              >
                ›
              </button>
            </form>
          )}
          {toolbar.includes('zoom') && (
            <div role="group" aria-label="Zoom">
              <button
                type="button"
                disabled={!count || zoom <= 0.25}
                onClick={() => changeZoom(-0.25)}
                aria-label="Reducir zoom"
              >
                −
              </button>
              <span>{Math.round(zoom * 100)} %</span>
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
          {toolbar.includes('settings') && (
            <details className="krpdf-settings">
              <summary>Opciones</summary>
              <label>
                Vista
                <select value={layout} onChange={event =>
                  setLayout(event.currentTarget.value === 'single' ? 'single' : 'continuous')
                }>
                  <option value="continuous">Scroll continuo</option>
                  <option value="single">Una página</option>
                </select>
              </label>
            </details>
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


