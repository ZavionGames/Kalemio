import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { edit } from '../src/lib/api'
import { message } from '../src/lib/message'
import { daily, localDay, remaining } from '../src/lib/state'
import { Dictionary } from '../src/lib/dictionary'
import { rule, matchCase } from '../src/lib/rules'
import { supported } from '../src/lib/access'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('AI client', () => {
  it('asks to refresh an open tab when the extension connection disappears', async () => {
    vi.stubGlobal('chrome', {})
    await expect(message('status')).rejects.toThrow('reloadTab')
    vi.stubGlobal('chrome', { runtime: {
      id: 'kalemio',
      sendMessage: () => Promise.reject(new Error('Extension context invalidated.'))
    } })
    await expect(message('status')).rejects.toThrow('reloadTab')
  })
  it('sends the contract and identity only to the worker', async () => {
    const mock = vi.fn(async () =>
      Response.json({ result: 'Bugün.', mode: 'fix' })
    )
    vi.stubGlobal('fetch', mock)
    expect(await edit('bugun', 'fix', 'id')).toBe('Bugün.')
    expect(mock).toHaveBeenCalledWith(
      expect.stringMatching(/workers\.dev\/$/),
      expect.objectContaining({
        body: JSON.stringify({ text: 'bugun', mode: 'fix', allowFallback: true }),
        headers: expect.objectContaining({ 'X-Install-Id': 'id' })
      })
    )
  })
  it.each([
    [429, 'geminiLimit'],
    [503, 'geminiBusy']
  ])('identifies Gemini status %s inside a Worker error', async (status, code) => {
    vi.stubGlobal('fetch', async () => Response.json({status}, {status:502}))
    await expect(edit('a', 'fluent', 'id')).rejects.toHaveProperty('code', code)
  })
  it.each([
    [403, 'forbidden'],
    [429, 'quota_exceeded'],
    [429, 'rate_limited'],
    [502, 'server']
  ])('maps %s %s', async (status, code) => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ error: code }, { status: Number(status) })
    )
    await expect(edit('a', 'fix', 'id')).rejects.toHaveProperty('code', code)
  })
  it('validates blank text and the exact 4000 boundary before sending', async () => {
    const mock = vi.fn(async () => Response.json({ result: 'x' }))
    vi.stubGlobal('fetch', mock)
    await expect(edit(' ', 'fix', 'id')).rejects.toHaveProperty('code', 'empty')
    await expect(edit('a'.repeat(4001), 'fix', 'id')).rejects.toHaveProperty(
      'code',
      'tooLong'
    )
    await edit('a'.repeat(4000), 'fix', 'id')
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('distinguishes offline and timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError()))
    await expect(edit('x', 'fix', 'id')).rejects.toHaveProperty(
      'code',
      'offline'
    )
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      (_: unknown, o: RequestInit) =>
        new Promise((_r, j) =>
          o.signal!.addEventListener('abort', () => j(new Error()))
        )
    )
    const pending = expect(edit('x', 'fix', 'id')).rejects.toHaveProperty(
      'code',
      'timeout'
    )
    await vi.advanceTimersByTimeAsync(15000)
    await pending
  })
})
describe('offline Turkish', () => {
  let d: Dictionary
  beforeAll(() => {
    const asset = (s: string) =>
      readFileSync('node_modules/dictionary-tr/index.' + s, 'utf8')
    d = new Dictionary(asset('aff'), asset('dic'))
  })
  it.each([
    ['yinede', 'yine de'],
    ['tabiki', 'tabii ki'],
    ['geldinmi', 'geldin mi'],
    ['Ankarada', "Ankara'da"],
    ['İyiki', 'İyi ki']
  ])('%s → %s', (word, expected) => expect(rule(word)).toContain(expected))
  it('preserves suffixes, legitimate ki, casing and local offsets', () => {
    expect(rule('evde')).toEqual([])
    expect(rule('halbuki')).toEqual([])
    expect(matchCase('ISTANBUL', 'istanbul')).toBe('İSTANBUL')
    const issues = d.scan('turkce yazim', [])
    expect(issues.map((i) => [i.start, i.choices[0]])).toEqual([
      [0, 'Türkçe'],
      [7, 'yazım']
    ])
    expect(d.correct('kitaplar')).toBe(true)
    expect(d.scan('Kalemiom', ['kalemiom'])).toEqual([])
    expect(d.scan('https://ornek.com', [])).toEqual([])
  })
})
it('resets allowance at local midnight', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 4, 1, 23, 59))
  const u = { day: localDay(), used: 9 }
  expect(remaining(u)).toBe(1)
  vi.advanceTimersByTime(60000)
  expect(daily(u).used).toBe(0)
  expect(remaining(u)).toBe(10)
})
it('excludes disabled hosts, banks, payment routes and Docs', () => {
  for (const u of [
    'https://garantibbva.com.tr',
    'https://example.org/checkout',
    'https://docs.google.com/document/d/id',
    'chrome://extensions'
  ])
    expect(supported(u)).toBe(false)
  expect(supported('https://mail.google.com', ['mail.google.com'])).toBe(false)
  expect(supported('https://mail.google.com')).toBe(true)
})
