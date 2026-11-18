import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Status } from './background'
import { config } from './config'
import { t } from './lib/i18n'
import { supported } from './lib/access'
import { message } from './lib/message'
import './ui.css'

const settings = location.pathname.endsWith('options.html')
function App() {
  const [state, setState] = useState<Status>(),
    [url, setUrl] = useState(''),
    [word, setWord] = useState('')
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false)
  const read = async () => setState(await message<Status>('status'))
  useEffect(() => {
    void read().catch(() => setNote(t('unexpected')))
    if (!settings)
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => setUrl(tab?.url || ''))
    const changed = () => {
      void read()
    }
    chrome.storage.onChanged.addListener(changed)
    const tick = setInterval(changed, 60000)
    return () => {
      clearInterval(tick)
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [])
  async function act(run: () => Promise<unknown>, success = 'saved') {
    setBusy(true)
    setNote('')
    try {
      await run()
      await read()
      setNote(t(success))
    } catch (e) {
      setNote(t((e as Error).message))
    } finally {
      setBusy(false)
    }
  }
  const brand = (
    <header>
      <span className="monogram" aria-hidden="true">
        k
      </span>
      <span className="brand">Kalemio</span>
    </header>
  )
  if (!state)
    return (
      <main>
        {brand}
        <p role="status">{note || '…'}</p>
      </main>
    )
  const host = supported(url) ? new URL(url).hostname : '',
    off = state.blocked.includes(host)
  const meter = (
    <div className="usage">
      <h2>{t('today')}</h2>
      <p>
        {t('left', { n: state.left, limit: config.dailyLimit })}
      </p>
        <meter
          min="0"
          max={config.dailyLimit}
          value={config.dailyLimit - state.left}
        />
    </div>
  )
  if (!settings)
    return (
      <main className="popup">
        {brand}
        {meter}
        <section>
          <h2>{t('local')}</h2>
          <p>{t('localInfo')}</p>
          {host ? (
            <>
              <b className="hostname">{host}</b>
              <button
                disabled={busy}
                onClick={() =>
                  void act(() => message('site', { host, block: !off }))
                }
              >
                {t(off ? 'enable' : 'disable')}
              </button>
            </>
          ) : (
            <p>{t('unsupported')}</p>
          )}
        </section>
        <button
          className="primary full"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          {t('settingsOpen')}{' '}
          <span>↗</span>
        </button>
        <output>{note}</output>
      </main>
    )
  return (
    <main className="options">
      {brand}
      <h1>{t('settings')}</h1>
      {meter}
      <section>
        <h2>{t('privacy')}</h2>
        <p>{t('consent')}</p>
        <p className="status">{t(state.consent ? 'allowed' : 'noConsent')}</p>
        {state.consent && (
          <button
            onClick={() => void act(() => message('consent', { value: false }))}
          >
            {t('revoke')}
          </button>
        )}
      </section>
      <section>
        <h2>{t('dict')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void act(async () => {
                  await message('word', { word })
                  setWord('')
                })
              }}
            >
              <label htmlFor="word">{t('word')}</label>
              <div className="row">
                <input
                  id="word"
                  maxLength={60}
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  required
                />
                <button disabled={busy}>{t('add')}</button>
              </div>
            </form>
            <ul>
              {state.personal.map((w) => (
                <li key={w}>
                  {w}
                  <button
                    onClick={() =>
                      void act(() => message('word', { word: w, remove: true }))
                    }
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>
      </section>
      <section>
        <h2>{t('blocked')}</h2>
        {state.blocked.length ? (
          <ul>
            {state.blocked.map((h) => (
              <li key={h}>
                {h}
                <button
                  onClick={() =>
                    void act(() => message('site', { host: h, block: false }))
                  }
                >
                  {t('enable')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('none')}</p>
        )}
      </section>
      <section>
        <button
          onClick={() =>
            void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
          }
        >
          {t('shortcuts')} ↗
        </button>
      </section>
      <output aria-live="polite">{note}</output>
    </main>
  )
}
document.documentElement.lang = chrome.i18n.getUILanguage()
createRoot(document.getElementById('root')!).render(<App />)
