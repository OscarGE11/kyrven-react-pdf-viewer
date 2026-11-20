import type { openPdf } from './document.js'

type OpenPdf = Awaited<ReturnType<typeof openPdf>>
type Size = { width: number; height: number }
type Sheet = { element: HTMLDivElement; canvas?: HTMLCanvasElement; failed?: boolean }

export function mountPages(
  viewport: HTMLDivElement,
  { render, pageCount }: OpenPdf,
  continuous: boolean,
  cacheLimit: number,
  initialZoom: number,
  onPage: (page: number) => void,
  onError: (error: Error) => void,
) {
  const strip = document.createElement('div')
  strip.className = 'krpdf-strip'
  viewport.append(strip)
  const sizes = new Map<number, Size>()
  const cache = new Set<Sheet>()
  let sheets: Sheet[] = []
  let page = 1
  let zoom = initialZoom
  let frame = 0
  let disposed = false
  let running: { number: number; abort: AbortController } | undefined

  function sizeSheet(sheet: Sheet, number: number) {
    const { width, height } = sizes.get(number) ?? { width: 612, height: 792 }
    sheet.element.style.width = `${width * zoom}px`
    sheet.element.style.height = `${height * zoom}px`
  }

  function release(sheet: Sheet) {
    if (sheet.canvas) {
      sheet.canvas.width = sheet.canvas.height = 0
      sheet.canvas.remove()
      sheet.canvas = undefined
    }
    cache.delete(sheet)
  }

  function goTo(number: number) {
    const target = Math.min(pageCount, Math.max(1, number))
    if (target !== page) {
      page = target
      onPage(page)
    }
    if (continuous) {
      viewport.scrollTop = page > 1 ? sheets[page - 1].element.offsetTop : 0
      schedule()
    } else {
      rebuild()
    }
  }

  function rebuild() {
    running?.abort.abort()
    for (const sheet of cache) release(sheet)
    const fragment = document.createDocumentFragment()
    sheets = Array.from({ length: continuous ? pageCount : 1 }, (_, index) => {
      const number = continuous ? index + 1 : page
      const element = document.createElement('div')
      element.className = 'krpdf-sheet'
      element.dataset.page = String(number)
      const sheet = { element }
      sizeSheet(sheet, number)
      fragment.append(element)
      return sheet
    })
    strip.replaceChildren(fragment)
    sizeBottomPadding()
    viewport.scrollTop = continuous && page > 1 ? sheets[page - 1].element.offsetTop : 0
    schedule()
  }

  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(renderVisible)
  }

  function sizeBottomPadding() {
    if (!continuous) strip.style.paddingBottom = ''
    if (continuous) {
      const lastSheet = sheets[sheets.length - 1].element
      strip.style.paddingBottom = `${Math.max(12, viewport.clientHeight - lastSheet.offsetHeight)}px`
    }
  }

  function wantedPages() {
    if (!continuous) return [page]
    const top = viewport.scrollTop
    const bottom = top + viewport.clientHeight
    let first = 0
    let last = sheets.length - 1
    while (first < last) {
      const middle = Math.floor((first + last) / 2)
      const { offsetTop, offsetHeight } = sheets[middle].element
      if (offsetTop + offsetHeight <= top) first = middle + 1
      else last = middle
    }
    if (first + 1 !== page) {
      page = first + 1
      onPage(page)
    }
    const wanted = [page]
    for (let i = first + 1; i < sheets.length && wanted.length < cacheLimit; i++) {
      if (sheets[i].element.offsetTop >= bottom) break
      wanted.push(i + 1)
    }
    const after = wanted[wanted.length - 1] + 1
    if (after <= pageCount) wanted.push(after)
    if (page > 1) wanted.push(page - 1)
    return wanted.slice(0, cacheLimit)
  }

  function renderVisible() {
    frame = 0
    const wanted = wantedPages()
    const getSheet = (number: number) => sheets[continuous ? number - 1 : 0]
    const kept = new Set(wanted.map(getSheet))
    for (const sheet of cache) if (!kept.has(sheet)) release(sheet)
    if (running) {
      if (!wanted.includes(running.number)) running.abort.abort()
      return
    }
    const number = wanted.find((value) => !getSheet(value).canvas && !getSheet(value).failed)
    if (number === undefined) return
    const sheet = getSheet(number)
    const abort = new AbortController()
    running = { number, abort }
    void render(number, zoom, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) {
          result.canvas.width = result.canvas.height = 0
          return
        }
        sizes.set(number, { width: result.width, height: result.height })
        sizeSheet(sheet, number)
        if (number === pageCount) sizeBottomPadding()
        sheet.canvas = result.canvas
        sheet.element.append(result.canvas)
        cache.add(sheet)
      })
      .catch((reason: unknown) => {
        if (abort.signal.aborted) return
        sheet.failed = true
        const error = reason instanceof Error ? reason.message : String(reason)
        onError(new Error(`Página ${number} · ${error}`))
      })
      .finally(() => {
        running = undefined
        schedule()
      })
  }

  rebuild()
  const resize = new ResizeObserver(() => {
    sizeBottomPadding()
    schedule()
  })
  resize.observe(viewport)
  viewport.addEventListener('scroll', schedule, { passive: true })
  return {
    goTo,
    configure(nextContinuous: boolean, nextCacheLimit: number) {
      cacheLimit = nextCacheLimit
      if (continuous === nextContinuous) schedule()
      else {
        continuous = nextContinuous
        rebuild()
      }
    },
    setZoom(value: number) {
      if (value === zoom) return
      zoom = value
      rebuild()
    },
    destroy() {
      disposed = true
      running?.abort.abort()
      cancelAnimationFrame(frame)
      resize.disconnect()
      viewport.removeEventListener('scroll', schedule)
      for (const sheet of cache) release(sheet)
      strip.remove()
    },
  }
}
