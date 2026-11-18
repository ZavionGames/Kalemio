import { diffWordsWithSpace } from 'diff'
import { config, modes, type Mode } from './config'
import type { Status } from './background'
import {
  fieldAt,
  frameAllowed,
  model,
  plain,
  replace,
  snapshot,
  type Field,
  type Snapshot
} from './editor'
import { mark } from './marks'
import { message } from './lib/message'
import { t } from './lib/i18n'
import type { Issue } from './lib/rules'
import { supported } from './lib/access'
import styles from './content.css?inline'

if (supported(location.href) && frameAllowed()) start()
function start() {
  const host = document.createElement('kalemio-assistant')
  host.style.cssText =
    'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important'
  const root = host.attachShadow({ mode: 'closed' })
  // Keep this message available even if reloading the extension invalidates its APIs.
  const reloadMessage = t('reloadTab')
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
    const el = document.createElement(tag)
    el.textContent = text
    return el
  }
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(styles)
  root.adoptedStyleSheets = [sheet]
  const pin = make('button', 'k'),
    card = make('section'),
    layer = make('div')
  pin.className = 'pin'
  pin.setAttribute('aria-label', t('menu'))
  pin.title = t('menu')
  card.className = 'card'
  card.setAttribute('aria-label', 'Kalemio')
  card.setAttribute('aria-live', 'polite')
  pin.hidden = card.hidden = true
  root.append(layer, pin, card)
  let field: Field | null = null,
    blocked: string[] = [],
    ready = false,
    issues: Issue[] = [],
    lastText = '',
    timer = 0,
    scanId = 0,
    viewId = 0,
    frame = 0
  let undo: (() => void) | null = null
  let sending = false
  const active = (el = field): el is Field =>
    !!el &&
    el.isConnected &&
    supported(location.href, blocked) &&
    fieldAt(el) === el
  function position() {
    if (!active()) {
      if (field) focus(null)
      return
    }
    const box = field!.getBoundingClientRect()
    const visible =
      box.bottom > 0 &&
      box.top < innerHeight &&
      box.right > 0 &&
      box.left < innerWidth &&
      box.height > 0
    pin.hidden = !visible
    if (!visible) {
      close()
      layer.replaceChildren()
      return
    }
    const x = Math.max(2, Math.min(innerWidth - 32, box.right - 31))
    const y = Math.max(2, Math.min(innerHeight - 32, box.bottom - 31))
    Object.assign(pin.style, { left: x + 'px', top: y + 'px' })
    card.style.left =
      Math.max(
        5,
        Math.min(innerWidth - card.offsetWidth - 6, x + 30 - card.offsetWidth)
      ) + 'px'
    card.style.top =
      (y + 34 + card.offsetHeight <= innerHeight
        ? y + 34
        : Math.max(5, y - card.offsetHeight - 3)) + 'px'
  }
  function paint() {
    if (active() && issues.length && lastText === model(field!).text)
      mark(layer, field!, issues, selectIssue)
    else layer.replaceChildren()
  }
  function reposition() {
    if (!field || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      position()
      paint()
    })
  }
  function close() {
    viewId++
    card.hidden = true
    card.replaceChildren()
  }
  function show() {
    card.hidden = false
    card.replaceChildren()
    card.append(make('strong', 'Kalemio'))
    position()
  }
  function button(
    parent: HTMLElement,
    label: string,
    run: () => void | Promise<void>,
    style = ''
  ) {
    const b = make('button', label)
    b.type = 'button'
    b.className = style
    b.onclick = (e) => {
      if (e.isTrusted && active())
        Promise.resolve()
          .then(run)
          .catch((error) => notice(error.message))
    }
    parent.append(b)
    return b
  }
  function notice(key: string) {
    if (!active()) return
    show()
    if (key === 'reloadTab' || !globalThis.chrome?.runtime?.id) {
      card.append(make('p', reloadMessage))
      position()
      return
    }
    card.append(make('p', t(key)))
    button(card, t('dismiss'), close)
    position()
  }
  async function status() {
    return message<Status & { enabled: boolean }>('status')
  }
  async function menu() {
    if (!active()) return
    if (!globalThis.chrome?.runtime?.id) return notice('reloadTab')
    const ticket = ++viewId
    show()
    const usage = make('p')
    usage.hidden = true
    card.append(usage)
    const grid = make('div')
    grid.className = 'grid'
    card.append(grid)
    for (const mode of modes) button(grid, t(mode), () => begin(mode))
    button(card, t('accent'), () => accentList())
    if (undo) button(card, t('undo'), undoLast)
    button(card, t('dismiss'), close)
    position()
    const state = await status().catch(() => null)
    if (!state || ticket !== viewId || !usage.isConnected) return
    if (!state.enabled) {
      focus(null)
      return
    }
    usage.textContent = t('left', { n: state.left, limit: config.dailyLimit })
    usage.hidden = false
    position()
  }
  function undoLast() {
    if (!undo) return
    undo()
    undo = null
    close()
    schedule()
  }
  function apply(s: Snapshot, value: string) {
    undo = replace(s, value)
    schedule()
    show()
    card.append(make('p', t('done')))
    button(card, t('undo'), undoLast, 'primary')
    button(card, t('dismiss'), close)
    position()
  }
  function selectIssue(issue: Issue) {
    if (sending) return
    if (!active() || lastText !== model(field!).text) return
    const s = snapshot(field!, [issue.start, issue.end])
    if (s.text !== issue.word) return
    viewId++
    show()
    card.append(make('p', issue.word))
    for (const choice of issue.choices)
      button(card, choice, () => apply(s, choice), 'primary')
    if (!issue.choices.length) card.append(make('p', t('noSuggestions')))
    button(card, t('dismiss'), close)
    position()
  }
  async function accentList() {
    if (!active()) return
    const s = snapshot(field!),
      ticket = ++viewId
    if (s.text.length > config.maxChars) {
      notice('tooLong')
      return
    }
    show()
    card.append(make('p', t('accentBusy')))
    const found = await message<Issue[]>('spell', {
      text: s.text,
      accents: true
    })
    if (ticket !== viewId || !active() || model(s.el).text !== s.full) return
    show()
    const offset = s.start
    lastText = s.full
    const tips = found.filter((i) => i.choices.length)
    if (!tips.length) card.append(make('p', t('noTips')))
    for (const i of tips)
      button(card, i.word + ' → ' + i.choices[0], () =>
        selectIssue({ ...i, start: i.start + offset, end: i.end + offset })
      )
    button(card, t('dismiss'), close)
    position()
  }
  async function begin(mode: Mode) {
    if (!active()) return
    if (sending) {
      notice('requestPending')
      return
    }
    const ticket = ++viewId,
      s = snapshot(field!)
    if (!s.text.trim()) {
      notice('empty')
      return
    }
    if (s.text.length > config.maxChars) {
      notice('tooLong')
      return
    }
    const state = await status()
    const current = () => ticket === viewId && field === s.el && active(s.el)
    if (!current()) return
    if (!state.left) {
      notice('quota_exceeded')
      return
    }
    let dispatched = false
    const send = async () => {
      if (dispatched || sending) return
      if (!current() || model(s.el).text !== s.full) {
        notice('stale')
        return
      }
      dispatched = true
      sending = true
      show()
      card.append(make('p', t('busy')))
      button(card, t('cancel'), close)
      let result: string
      try {
        result = await message<string>('ai', { mode, text: s.text })
      } catch (e) {
        if (current()) notice((e as Error).message)
        return
      } finally {
        sending = false
      }
      if (!current()) return
      if (model(s.el).text !== s.full) {
        notice('stale')
        return
      }
      show()
      if (mode === 'analyze') {
        const analysis = JSON.parse(result)
        for (const key of [
          'readability',
          'repeatedWords',
          'averageSentenceLength',
          'suggestions'
        ]) {
          card.append(
            make('small', t(key)),
            make(
              'p',
              Array.isArray(analysis[key])
                ? analysis[key].join(' · ')
                : String(analysis[key])
            )
          )
        }
      } else {
        const before = make('p'),
          after = make('p')
        for (const part of diffWordsWithSpace(s.text, result)) {
          if (!part.added)
            before.append(make(part.removed ? 'del' : 'span', part.value))
          if (!part.removed)
            after.append(make(part.added ? 'ins' : 'span', part.value))
        }
        card.append(
          make('small', t('before')),
          before,
          make('small', t('after')),
          after
        )
        button(card, t('apply'), () => apply(s, result), 'primary')
      }
      button(card, t('cancel'), close)
      position()
    }
    if (state.consent) {
      await send()
      return
    }
    show()
    card.append(make('p', t('consent')))
    button(
      card,
      t('allow'),
      async () => {
        await message('consent', { value: true })
        await send()
      },
      'primary'
    )
    button(card, t('cancel'), close)
    position()
  }
  function schedule() {
    const id = ++scanId
    clearTimeout(timer)
    issues = []
    layer.replaceChildren()
    if (!active()) return
    timer = window.setTimeout(async () => {
      if (!active() || id !== scanId) return
      const source = model(field!).text
      lastText = source
      try {
        for (let at = 0; at < source.length && id === scanId; ) {
          let end = Math.min(at + 3200, source.length)
          while (
            end > at + 3000 &&
            end < source.length &&
            /\p{L}/u.test(source[end])
          )
            end--
          const batch = await message<Issue[]>('spell', {
            text: source.slice(at, end)
          })
          if (id !== scanId || !active()) return
          issues.push(
            ...batch.map((i) => ({
              ...i,
              start: i.start + at,
              end: i.end + at
            }))
          )
          at = end
          reposition()
          await new Promise((r) => setTimeout(r, 15))
        }
      } catch {
        if (id === scanId) layer.replaceChildren()
      }
    }, 250)
  }
  function focus(next: Field | null) {
    if (!ready || !supported(location.href, blocked)) next = null
    if (next === field) return
    close()
    undo = null
    field = next
    pin.hidden = !next
    void message('context', { enabled: !!next }).catch(() => {})
    if (next) {
      const container = next.closest('dialog[open], [popover]:popover-open') || document.documentElement
      if (host.parentElement !== container) container.append(host)
      if (typeof host.showPopover === 'function' && !host.matches(':popover-open')) {
        host.popover = 'manual'
        host.showPopover()
      }
    }
    schedule()
    position()
    if (!next) host.remove()
  }
  // Keep page-level outside-click handlers from dismissing the active editor.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'])
    root.addEventListener(type, (e) => {
      if (type === 'mousedown') e.preventDefault()
      e.stopPropagation()
    })
  pin.onclick = (e) => {
    if (e.isTrusted) {
      if (card.hidden) void menu().catch((error) => notice(error.message))
      else close()
    }
  }
  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target !== host) focus(fieldAt(e.composedPath()[0]))
    },
    true
  )
  document.addEventListener(
    'focusout',
    () =>
      queueMicrotask(() => {
        if (document.activeElement !== host)
          focus(focusedField())
      }),
    true
  )
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target !== host && !fieldAt(e.composedPath()[0])) focus(null)
    },
    true
  )
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (e.target !== host) focus(fieldAt(e.composedPath()[0]))
    },
    true
  )
  document.addEventListener(
    'click',
    (e) => {
      if (
        sending || !e.isTrusted ||
        !field ||
        e.target === host ||
        fieldAt(e.composedPath()[0]) !== field ||
        !issues.length
      )
        return
      let issue: Issue | undefined
      if (plain(field)) {
        const at = field.selectionStart
        if (at !== null && at === field.selectionEnd)
          issue = issues.find((i) => i.start <= at && at < i.end)
      } else {
        const s = getSelection()
        if (s?.isCollapsed && s.anchorNode) {
          const m = model(field)
          issue = issues.find((i) =>
            m
              .range(i.start, i.end)
              ?.isPointInRange(s.anchorNode!, s.anchorOffset)
          )
        }
      }
      if (issue) selectIssue(issue)
      else close()
    },
    true
  )
  document.addEventListener(
    'input',
    (e) => {
      if (field && field.contains(e.target as Node)) {
        close()
        undo = null
        schedule()
      }
    },
    true
  )
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') close()
    },
    true
  )
  document.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
  const observer = new MutationObserver((records) => {
    if (!field) return
    if (!active()) {
      focus(null)
      return
    }
    if (records.some((r) => field!.contains(r.target))) {
      schedule()
      reposition()
    }
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'type',
      'autocomplete',
      'contenteditable',
      'name',
      'readonly',
      'disabled',
      'class',
      'id',
      'aria-label'
    ]
  })
  function focusedField() {
    let node = document.activeElement
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement
    return fieldAt(node)
  }
  async function prefs() {
    const s = await status()
    blocked = s.blocked
    ready = true
    focus(s.enabled ? focusedField() : null)
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'reloadPrefs') {
      void prefs().catch((error) => notice(error.message))
      return
    }
    if (msg.action === 'contextSync') {
      void message('context', { enabled: active() }).catch(() => {})
      return
    }
    if (!active()) focus(focusedField())
    if (!active() || (msg.action === 'menu' && !document.hasFocus())) return
    if (msg.action === 'menu') void menu().catch((error) => notice(error.message))
    if (msg.action === 'fix') void begin('fix').catch((e) => notice(e.message))
  })
  void prefs().catch(() => {})
}
