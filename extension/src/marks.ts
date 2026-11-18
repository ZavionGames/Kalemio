import { model, plain, type Field } from './editor'
import type { Issue } from './lib/rules'
// A temporary typography mirror provides Range coordinates for native form controls.
export function mark(
  layer: HTMLElement,
  el: Field,
  issues: Issue[],
  select: (i: Issue) => void
) {
  layer.replaceChildren()
  if (!issues.length) return
  const box = el.getBoundingClientRect()
  if (box.bottom < 0 || box.top > innerHeight) return
  let mirror: HTMLDivElement | undefined
  let range: (a: number, b: number) => Range | null
  if (plain(el)) {
    mirror = document.createElement('div')
    const css = getComputedStyle(el)
    for (const name of [
      'font',
      'font-kerning',
      'font-feature-settings',
      'line-height',
      'letter-spacing',
      'word-spacing',
      'text-indent',
      'text-align',
      'text-transform',
      'direction',
      'tab-size',
      'padding',
      'border-width',
      'border-style',
      'box-sizing',
      'overflow-wrap',
      'word-break'
    ])
      mirror.style.setProperty(name, css.getPropertyValue(name))
    Object.assign(mirror.style, {
      position: 'fixed',
      left: box.left + 'px',
      top: box.top + 'px',
      width:
        el.clientWidth +
        parseFloat(css.borderLeftWidth) +
        parseFloat(css.borderRightWidth) +
        'px',
      height: box.height + 'px',
      boxSizing: 'border-box',
      whiteSpace: el instanceof HTMLInputElement ? 'pre' : 'pre-wrap',
      overflow: 'hidden',
      visibility: 'hidden'
    })
    if (el instanceof HTMLInputElement)
      mirror.style.lineHeight =
        el.clientHeight -
        parseFloat(css.paddingTop) -
        parseFloat(css.paddingBottom) +
        'px'
    const node = document.createTextNode(el.value)
    mirror.append(node)
    layer.append(mirror)
    mirror.scrollTop = el.scrollTop
    mirror.scrollLeft = el.scrollLeft
    range = (a, b) => {
      const r = document.createRange()
      r.setStart(node, a)
      r.setEnd(node, b)
      return r
    }
  } else range = model(el).range
  const fragment = document.createDocumentFragment()
  // Offscreen lines need no DOM markers. Find the first visible line before painting.
  let first = 0,
    limit = issues.length
  const top = Math.max(0, box.top),
    bottom = Math.min(innerHeight, box.bottom)
  while (first < limit) {
    const mid = (first + limit) >>> 1,
      issue = issues[mid]
    const rect = range(issue.start, issue.end)?.getBoundingClientRect()
    if (rect && rect.bottom < top) first = mid + 1
    else limit = mid
  }
  for (let n = first; n < issues.length; n++) {
    const issue = issues[n]
    const rects = range(issue.start, issue.end)?.getClientRects()
    if (rects?.length && rects[0].top > bottom) break
    for (const rect of rects || []) {
      const y = rect.bottom - 2,
        left = Math.max(rect.left, box.left, 0),
        right = Math.min(rect.right, box.right, innerWidth)
      if (
        y < Math.max(box.top, 0) ||
        y > Math.min(box.bottom, innerHeight) ||
        left >= right
      )
        continue
      const btn = document.createElement('button')
      btn.className = 'underline ' + issue.kind
      btn.title = issue.word
      btn.setAttribute('aria-label', issue.word)
      btn.tabIndex = -1
      Object.assign(btn.style, {
        left: left + 'px',
        top: y - 2 + 'px',
        width: right - left + 'px'
      })
      btn.onmousedown = (e) => e.preventDefault()
      btn.onclick = (e) => {
        if (e.isTrusted) select(issue)
      }
      fragment.append(btn)
    }
  }
  mirror?.remove()
  layer.append(fragment)
}
