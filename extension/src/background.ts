import { config, modes, type Mode } from './config'
import { ApiError, edit } from './lib/api'
import { daily, remaining, type Usage } from './lib/state'
import { supported } from './lib/access'
import { t } from './lib/i18n'
const store = chrome.storage.local
type Stored = {
  installId?: string
  usage?: Usage
  providerConsent?: boolean
  blocked?: string[]
  personal?: string[]
}
const readState = (keys: keyof Stored | (keyof Stored)[]): Promise<Stored> =>
  store.get(keys)
void store.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
let creating: Promise<void> | undefined
async function dictionary() {
  if (await chrome.offscreen.hasDocument()) return
  creating ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification:
        'Run the private Turkish spelling dictionary in a local web worker.'
    })
    .finally(() => {
      creating = undefined
    })
  await creating
}
let identifying: Promise<string> | undefined
function installId() {
  identifying ??= (async () => {
    const { installId: known } = await readState('installId')
    if (known) return known as string
    const id = crypto.randomUUID()
    await store.set({ installId: id })
    return id
  })().catch((e) => {
    identifying = undefined
    throw e
  })
  return identifying
}
chrome.runtime.onInstalled.addListener(() => {
  void store.remove(['licenseKey', 'license', 'testPremium'])
  void installId()
})
let serial = Promise.resolve()
function exclusive<T>(run: () => Promise<T>) {
  const next = serial.then(run)
  serial = next.then(
    () => {},
    () => {}
  )
  return next
}
async function status() {
  const s = await readState([
    'providerConsent',
    'usage',
    'blocked',
    'personal'
  ])
  return {
    consent: !!s.providerConsent,
    left: remaining(s.usage),
    blocked: (s.blocked || []) as string[],
    personal: (s.personal || []) as string[]
  }
}
export type Status = Awaited<ReturnType<typeof status>>
async function dispatch(msg: any, sender: chrome.runtime.MessageSender) {
  const page = sender.url?.startsWith(chrome.runtime.getURL(''))
  if (sender.id !== chrome.runtime.id || (!page && !sender.tab))
    throw new ApiError('forbidden')
  if (
    !page &&
    !supported(sender.url || '', (await readState('blocked')).blocked || [])
  ) {
    if (msg.type === 'context') {
      await context(false, sender)
      return
    }
    if (msg.type === 'status')
      return { ...(await status()), enabled: false, personal: [] }
    throw new ApiError('forbidden')
  }
  switch (msg.type) {
    case 'context':
      await context(!!msg.enabled, sender)
      return
    case 'status':
      return { ...(await status()), enabled: true }
    case 'settings':
      await chrome.runtime.openOptionsPage()
      return
    case 'spell': {
      if (typeof msg.text !== 'string' || msg.text.length > 5000)
        throw new ApiError('tooLong')
      const state = await status()
      await dictionary()
      const res = await chrome.runtime.sendMessage({
        target: 'dictionary',
        text: msg.text,
        accents: !!msg.accents,
        personal: state.personal
      })
      if (!res || res.error) throw new ApiError('dictionary')
      return res.issues
    }
    case 'consent':
      await store.set({ providerConsent: msg.value === true })
      return
    case 'ai': {
      const state = await status(),
        mode = msg.mode as Mode
      if (!state.consent) throw new ApiError('consentNeeded')
      if (!modes.includes(mode)) throw new ApiError('unexpected')
      if (!state.left) throw new ApiError('quota_exceeded')
      try {
        const result = await edit(msg.text, mode, await installId())
        await exclusive(async () => {
          const usage = daily((await readState('usage')).usage)
          await store.set({ usage: { ...usage, used: Math.min(config.dailyLimit, usage.used + 1) } })
        })
        return result
      } catch (e) {
        if (e instanceof ApiError && e.code === 'quota_exceeded')
          await store.set({ usage: { ...daily(), used: config.dailyLimit } })
        throw e
      }
    }
  }
  if (!page) throw new ApiError('forbidden')
  return exclusive(async () => {
    const state = await status()
    switch (msg.type) {
      case 'site': {
        const host = String(msg.host)
        if (!/^[a-z0-9.:[\]-]+$/i.test(host)) throw new ApiError('unexpected')
        await store.set({
          blocked: msg.block
            ? [...new Set([...state.blocked, host])]
            : state.blocked.filter((h) => h !== host)
        })
        for (const tab of await chrome.tabs.query({}))
          if (tab.id)
            void chrome.tabs
              .sendMessage(tab.id, { action: 'reloadPrefs' })
              .catch(() => {})
        return
      }
      case 'word': {
        const word = String(msg.word).trim().toLocaleLowerCase('tr-TR')
        if (!/^[\p{L}'’\-]{1,60}$/u.test(word)) throw new ApiError('unexpected')
        await store.set({
          personal: msg.remove
            ? state.personal.filter((w) => w !== word)
            : [...new Set([...state.personal, word])].slice(-5000)
        })
        return
      }
      default:
        throw new ApiError('unexpected')
    }
  })
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg?.type || msg.target) return
  void dispatch(msg, sender).then(
    (data) => reply({ ok: true, data }),
    (e) =>
      reply({ ok: false, error: e instanceof ApiError ? e.code : 'unexpected' })
  )
  return true
})
let menuQueue = Promise.resolve()
function setMenu(enabled: boolean, url?: string) {
  menuQueue = menuQueue
    .catch(() => {})
    .then(async () => {
      await chrome.contextMenus.removeAll()
      if (enabled && url)
        await new Promise<void>((resolve) => {
          chrome.contextMenus.create(
            {
              id: 'fix',
              title: t('context'),
              contexts: ['editable'],
              documentUrlPatterns: [new URL(url).origin + '/*']
            },
            () => {
              void chrome.runtime.lastError
              resolve()
            }
          )
        })
    })
  return menuQueue
}
async function context(enabled: boolean, sender: chrome.runtime.MessageSender) {
  if (!sender.tab?.id || !(await chrome.tabs.get(sender.tab.id)).active) return
  await setMenu(enabled, sender.url)
}
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void setMenu(false)
  void chrome.tabs.sendMessage(tabId, { action: 'contextSync' }).catch(() => {})
})
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && change.status === 'loading') void setMenu(false)
})
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id && info.menuItemId === 'fix')
    void chrome.tabs
      .sendMessage(tab.id, { action: 'fix' }, { frameId: info.frameId || 0 })
      .catch(() => {})
})
chrome.commands.onCommand.addListener(async (_command, tab) => {
  if (tab?.id)
    await chrome.tabs.sendMessage(tab.id, { action: 'menu' }).catch(() => {})
})
