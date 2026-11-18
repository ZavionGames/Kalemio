import { supported } from './lib/access'
export type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement
export const plain = (
  el: Field
): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
const sensitiveToken =
  /(?:cc-|one-time-code|password|passcode|parola|şifre|sifre|payment|checkout|ödeme|odeme|credit.?card|card.?num|card.?holder|kart|cvv|cvc|iban|bank.?account|routing.?num|security.?code|kredi|otp)/i
function sensitive(el: Element) {
  return (
    [...el.attributes].some(
      (a) =>
        [
          'name',
          'autocomplete',
          'id',
          'class',
          'aria-label',
          'placeholder',
          'action',
          'data-testid',
          'title'
        ].includes(a.name) && sensitiveToken.test(a.value)
    ) || el.matches('input[type=password]')
  )
}
export function fieldAt(node: EventTarget | null): Field | null {
  if (!(node instanceof Element) || !supported(location.href)) return null
  if (!frameAllowed()) return null
  let el = node.closest<HTMLElement>('textarea,input,[contenteditable]')
  if (
    !el ||
    el.closest('[contenteditable=false]') ||
    el.closest('[inert],[aria-disabled=true],[aria-readonly=true]')
  )
    return null
  if (plain(el)) {
    if (
      el.disabled ||
      el.readOnly ||
      (el instanceof HTMLInputElement && el.type !== 'text')
    )
      return null
  } else {
    if (!el.isContentEditable) return null
    while (el.parentElement?.isContentEditable) el = el.parentElement
  }
  for (let p: Element | null = el; p; p = composedParent(p))
    if (sensitive(p)) return null
  const form =
    (plain(el) ? el.form : null) || el.closest('form,[role=form],fieldset')
  if (
    form &&
    [...form.querySelectorAll('input,select,textarea')].some(sensitive)
  )
    return null
  const labels = plain(el)
    ? Array.from(el.labels || [])
        .map((l) => l.textContent)
        .join(' ')
    : ''
  if (sensitiveToken.test(labels)) return null
  return el
}
function composedParent(node: Element): Element | null {
  const root = node.getRootNode()
  return node.parentElement || (root instanceof ShadowRoot ? root.host : null)
}
export function frameAllowed() {
  try {
    for (let frame: Window = window; frame !== frame.top; frame = frame.parent) {
      if (frame.parent.location.origin !== location.origin || !supported(frame.parent.location.href)) return false
      for (let el = frame.frameElement; el; el = composedParent(el)) {
        if (sensitive(el) || el.matches('form,fieldset,[role=form]')) return false
      }
    }
    return true
  } catch { return false }
}
type Point = { node: Node; offset: number }
type Segment = {
  start: number
  end: number
  from: Point
  to: Point
  textNode: boolean
}
export function model(el: Field) {
  if (plain(el))
    return {
      text: el.value,
      range: (_start: number, _end: number): Range | null => null
    }
  const parts: string[] = [],
    segments: Segment[] = []
  let size = 0
  const append = (s: string, from: Point, to: Point, textNode = false) => {
    if (!s) return
    segments.push({ start: size, end: size + s.length, from, to, textNode })
    parts.push(s)
    size += s.length
  }
  const walk = (parent: Node) => {
    let previousBlock = false
    parent.childNodes.forEach((node, index) => {
      const before = { node: parent, offset: index },
        after = { node: parent, offset: index + 1 }
      const block =
        node instanceof Element &&
        /^(DIV|P|LI|BLOCKQUOTE|H[1-6])$/.test(node.tagName)
      if (
        index &&
        (block || previousBlock) &&
        parts.length &&
        !parts.at(-1)!.endsWith('\n')
      )
        append('\n', before, before)
      if (node.nodeType === Node.TEXT_NODE)
        append(
          node.textContent || '',
          { node, offset: 0 },
          { node, offset: node.textContent?.length || 0 },
          true
        )
      else if (node instanceof HTMLBRElement) append('\n', before, after)
      else if (
        node instanceof Element &&
        !node.matches('script,style,[contenteditable=false],[hidden]')
      )
        walk(node)
      previousBlock = block
    })
  }
  walk(el)
  const point = (i: number, end: boolean): Point => {
    let lo = 0,
      hi = segments.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (segments[mid].end < i || (!end && segments[mid].end === i))
        lo = mid + 1
      else hi = mid
    }
    const s = segments[lo]
    if (!s) return { node: el, offset: el.childNodes.length }
    return s.textNode
      ? { node: s.from.node, offset: i - s.start }
      : i <= s.start
        ? s.from
        : s.to
  }
  return {
    text: parts.join(''),
    range: (start: number, end: number) => {
      const r = document.createRange(),
        a = point(start, false),
        b = point(end, true)
      r.setStart(a.node, a.offset)
      if (start === end) r.collapse(true)
      else r.setEnd(b.node, b.offset)
      return r
    }
  }
}
export type Snapshot = {
  el: Field
  full: string
  text: string
  start: number
  end: number
  range: Range | null
}
export function snapshot(el: Field, interval?: [number, number]): Snapshot {
  const m = model(el)
  let [start, end] = interval || [0, m.text.length]
  let range: Range | null = null
  if (plain(el)) {
    if (!interval && el.selectionStart !== el.selectionEnd) {
      start = el.selectionStart!
      end = el.selectionEnd!
    }
  } else {
    const sel = getSelection()
    if (
      !interval &&
      sel?.rangeCount &&
      !sel.isCollapsed &&
      el.contains(sel.anchorNode) &&
      el.contains(sel.focusNode)
    ) {
      range = sel.getRangeAt(0).cloneRange()
      // Map DOM endpoints back into the same multiline text used for spell offsets.
      const offsetAt = (node: Node, offset: number) => {
        let lo = 0,
          hi = m.text.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1,
            probe = m.range(mid, mid)!
          probe.collapse(true)
          if (probe.comparePoint(node, offset) > 0) lo = mid + 1
          else hi = mid
        }
        return lo
      }
      start = offsetAt(range.startContainer, range.startOffset)
      end = offsetAt(range.endContainer, range.endOffset)
    } else if (!interval) {
      range = document.createRange()
      range.selectNodeContents(el)
    } else range = m.range(start, end)
  }
  return { el, full: m.text, text: m.text.slice(start, end), start, end, range }
}
export function replace(s: Snapshot, value: string): () => void {
  const { el, range } = s
  const check = (expected: string) => {
    if (!el.isConnected || fieldAt(el) !== el || model(el).text !== expected)
      throw new Error('stale')
  }
  check(s.full)
  el.focus({ preventScroll: true })
  const events = () => {
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: value
      })
    )
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (plain(el)) {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      'value'
    )!.set!
    const newValue = s.full.slice(0, s.start) + value + s.full.slice(s.end)
    setter.call(el, newValue)
    el.setSelectionRange(s.start + value.length, s.start + value.length)
    events()
    return () => {
      check(newValue)
      setter.call(el, s.full)
      el.setSelectionRange(s.start, s.end)
      events()
    }
  }
  if (
    !range ||
    !el.contains(range.commonAncestorContainer) ||
    Array.from(el.querySelectorAll('[contenteditable=false]')).some((node) =>
      range.intersectsNode(node)
    )
  )
    throw new Error('stale')
  const sel = getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  if (!document.execCommand('insertText', false, value))
    throw new Error('stale')
  el.dispatchEvent(new Event('change', { bubbles: true }))
  const updated = model(el).text
  return () => {
    check(updated)
    el.focus({ preventScroll: true })
    if (!document.execCommand('undo') || model(el).text !== s.full)
      throw new Error('stale')
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}
