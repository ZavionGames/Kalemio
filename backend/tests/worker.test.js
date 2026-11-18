import { beforeAll, afterAll, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { runtime } from './runtime.mjs'
import { modes } from '../src/gemini.js'
let r
beforeAll(async () => {
  r = await runtime()
}, 45000)
afterAll(async () => {
  await r?.mf.dispose()
})
let address = 1
function client(ip = '198.51.100.' + address++) {
  const headers = { 'X-Install-Id': randomUUID(), 'CF-Connecting-IP': ip }
  return {
    ai: (mode = 'fix', text = 'bugun') => r.post('/', { mode, text }, headers)
  }
}
it('validates bodies, sizes, methods and legacy requests', async () => {
  expect((await r.post('/', '{')).status).toBe(400)
  expect((await r.post('/', null)).status).toBe(400)
  expect((await r.post('/', { text: 'a'.repeat(4001) })).status).toBe(413)
  expect((await r.post('/', 'a'.repeat(33000))).status).toBe(413)
  expect((await r.post('/', { text: '   ' })).status).toBe(400)
  expect((await r.post('/', { text: 'bir', mode: 'constructor' })).status).toBe(
    200
  )
  expect((await r.post('/license', { licenseKey: randomUUID() })).status).toBe(
    404
  )
  expect((await r.mf.dispatchFetch('http://test/')).status).toBe(405)
})
it('enforces the quota under concurrency and releases failed reservations', async () => {
  const c = client()
  expect((await c.ai('fix', 'upstream failure')).status).toBe(502)
  const answers = await Promise.all(Array.from({ length: 12 }, () => c.ai()))
  expect(answers.filter((res) => res.status === 200)).toHaveLength(10)
  for (const res of answers.filter((res) => res.status !== 200))
    expect(await res.json()).toEqual({ error: 'quota_exceeded' })
})
it('rate limits changing installation IDs from one address', async () => {
  const ip = '203.0.113.92'
  for (let i = 0; i < 20; i++)
    expect((await client(ip).ai('formal', '')).status).toBe(400)
  expect(await (await client(ip).ai()).json()).toEqual({
    error: 'rate_limited'
  })
})
it('uses the fallback once per transient failure and charges one successful edit', async () => {
  const headers = {'X-Install-Id':randomUUID(), 'CF-Connecting-IP':'198.51.100.90'}
  const ai = text => r.post('/', {text,mode:'fix',allowFallback:true}, headers)
  const start = r.calls.length
  expect((await ai('bugun')).status).toBe(200)
  expect(r.calls.slice(start)).toEqual([1])
  expect(await (await ai('upstream failure')).json()).toEqual({mode:'fix',result:'Yedek yanıt.'})
  const fallbackModel = 'nvidia/nemotron-3.5-lightning:free'
  const groqModel = 'openai/gpt-oss-20b'
  expect(r.calls.slice(start)).toEqual([1,1,'gemini2',groqModel,fallbackModel])
  expect((await ai('both unavailable')).status).toBe(502)
  expect(r.calls.slice(start)).toEqual([1,1,'gemini2',groqModel,fallbackModel,1,'gemini2',groqModel,fallbackModel])
  const beforeGroq = r.calls.length
  expect(await (await ai('groq succeeds')).json()).toEqual({mode:'fix',result:'İkinci yanıt.'})
  expect(r.calls.slice(beforeGroq)).toEqual([1,'gemini2',groqModel])
  const beforeSecond = r.calls.length
  expect((await ai('second succeeds')).status).toBe(200)
  expect(r.calls.slice(beforeSecond)).toEqual([1,'gemini2'])
  for (let i=0;i<6;i++) expect((await ai('bugun')).status).toBe(200)
  expect((await ai('bugun')).status).toBe(429)
})
it('shares ten successful requests across all modes', async () => {
  const c = client()
  for (const mode of Object.keys(modes)) expect((await c.ai(mode)).status).toBe(200)
  expect(await (await c.ai('formal')).json()).toEqual({ error: 'quota_exceeded' })
})
