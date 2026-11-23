import type { PageSize, ViewerDocument } from './document.js'

export type ViewerZoom = number | 'fit-width' | 'fit-page'
export type ViewerRotation = 0 | 90 | 180 | 270
type PageLabels = { page: (number: number) => string; image: string }
type Sheet = { element: HTMLDivElement; canvas?: HTMLCanvasElement; failed?: boolean }

export function mountPages(
  viewport: HTMLDivElement,
  { render, pageCount, firstPageSize, kind }: ViewerDocument,
  continuous: boolean,
  cacheLimit: number,
  initialZoom: ViewerZoom,
  initialRotation: ViewerRotation,
  pageLabels: PageLabels,
  onPage: (page: number) => void,
  onZoom: (zoom: number) => void,
  onError: (error: Error) => void,
) {
  const strip = document.createElement('div')
  strip.className = 'krpdf-strip'
  viewport.append(strip)
  const sizes = new Map<number, PageSize>()
  if (firstPageSize) sizes.set(1, firstPageSize)
  const cache = new Set<Sheet>()
  let sheets: Sheet[] = []
  let page = 1
  let zoom = initialZoom
  let rotation = initialRotation
  let availableWidth = 0
  let availableHeight = 0
  let frame = 0
  let disposed = false
  let running: { number: number; abort: AbortController } | undefined

  function getSize(number: number) {
    return sizes.get(number) ?? sizes.get(1) ?? { width: 612, height: 792 }
  }

  function readViewport() {
    const style = getComputedStyle(strip)
    const width = Math.max(1, viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
    const height = Math.max(1, viewport.clientHeight - 2 * parseFloat(style.paddingTop))
    const changed = width !== availableWidth || height !== availableHeight
    availableWidth = width
    availableHeight = height
    return changed
  }

  function pageZoom(size: PageSize) {
    if (typeof zoom === 'number') return zoom
    const sideways = rotation % 180 !== 0
    const width = availableWidth / (sideways ? size.height : size.width)
    const height = availableHeight / (sideways ? size.width : size.height)
    return zoom === 'fit-page' ? Math.min(width, height) : width
  }

  function labelCanvas(canvas: HTMLCanvasElement, number: number) {
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', kind === 'image' ? pageLabels.image : pageLabels.page(number))
  }

  function sizeSheet(sheet: Sheet, number: number) {
    const size = getSize(number)
    const scale = pageZoom(size)
    const width = size.width * scale
    const height = size.height * scale
    const sideways = rotation % 180 !== 0
    sheet.element.style.width = `${sideways ? height : width}px`
    sheet.element.style.height = `${sideways ? width : height}px`
    if (sheet.canvas) {
      sheet.canvas.style.width = `${width}px`
      sheet.canvas.style.height = `${height}px`
      sheet.canvas.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`
    }
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
    readViewport()
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
    onZoom(pageZoom(getSize(page)))
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
    onZoom(pageZoom(getSize(page)))
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
    const scale = pageZoom(getSize(number))
    void render(number, scale, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) {
          result.canvas.width = result.canvas.height = 0
          return
        }
        const newFirstSize = number === 1 && !sizes.has(1)
        const active = getSheet(page)
        const oldTop = active.element.offsetTop
        sizes.set(number, { width: result.width, height: result.height })
        if (Math.abs(pageZoom(getSize(number)) / scale - 1) > 0.05) {
          result.canvas.width = result.canvas.height = 0
        } else {
          labelCanvas(result.canvas, number)
          sheet.canvas = result.canvas
          sheet.element.append(result.canvas)
          cache.add(sheet)
        }
        if (newFirstSize) sheets.forEach((item, index) => sizeSheet(item, continuous ? index + 1 : page))
        else sizeSheet(sheet, number)
        if (continuous) {
          sizeBottomPadding()
          viewport.scrollTop += active.element.offsetTop - oldTop
        }
      })
      .catch((reason: unknown) => {
        if (abort.signal.aborted) return
        sheet.failed = true
        const error = reason instanceof Error ? reason.message : String(reason)
        onError(new Error(`${kind === 'image' ? pageLabels.image : pageLabels.page(number)} · ${error}`))
      })
      .finally(() => {
        running = undefined
        schedule()
      })
  }

  rebuild()
  const resize = new ResizeObserver(() => {
    if (readViewport() && typeof zoom !== 'number') {
      rebuild()
      return
    }
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
    setView(value: ViewerZoom, angle: ViewerRotation) {
      if (value === zoom && angle === rotation) return
      if (typeof zoom === 'number' && zoom === value) {
        rotation = angle
        sheets.forEach((sheet, index) => sizeSheet(sheet, continuous ? index + 1 : page))
        sizeBottomPadding()
        viewport.scrollTop = continuous && page > 1 ? sheets[page - 1].element.offsetTop : 0
        schedule()
        return
      }
      zoom = value
      rotation = angle
      rebuild()
    },
    setLabels(labels: PageLabels) {
      pageLabels = labels
      for (const sheet of cache) {
        if (sheet.canvas) labelCanvas(sheet.canvas, Number(sheet.element.dataset.page))
      }
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
