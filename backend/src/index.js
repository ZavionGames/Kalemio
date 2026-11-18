import limits from '../../shared/limits.json' with { type: 'json' }
import { generate, modes } from './gemini.js'
export { Ledger } from './ledger.js'
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
async function readLimited(req, limit) {
  if (+req.headers.get('content-length') > limit) throw 413
  const reader = req.body?.getReader()
  if (!reader) throw 400
  const bytes = new Uint8Array(limit)
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (size + value.length > limit) {
      await reader.cancel()
      throw 413
    }
    bytes.set(value, size)
    size += value.length
  }
  const input = bytes.subarray(0, size)
  const body = new TextDecoder().decode(input)
  // The default decoder replaces invalid bytes. Verify ambiguous text before accepting it.
  if (body.includes('\uFFFD')) {
    const offset = input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf ? 3 : 0
    const encoded = new TextEncoder().encode(body)
    if (encoded.length !== size - offset || encoded.some((byte, i) => byte !== input[offset + i]))
      throw 400
  }
  return body
}
async function digest(text) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  )
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
export function createWorker({ send = fetch } = {}) {
  return {
    async fetch(req, env) {
      const path = new URL(req.url).pathname
      const origin = req.headers.get('Origin') || ''
      const allowed = !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN
      const headers = {
        Vary: 'Origin',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, X-Install-Id, X-Time-Zone'
      }
      if (allowed)
        headers['Access-Control-Allow-Origin'] = origin || '*'
      const json = (value, status = 200) =>
        Response.json(value, { status, headers })
      const fail = (msg, status) => json({ error: msg }, status)
      if (path !== '/')
        return fail('Bulunamadı.', 404)
      if (!allowed)
        return fail('İzin verilmeyen kaynak.', 403)
      if (req.method === 'OPTIONS')
        return new Response(null, { status: 204, headers })
      if (req.method !== 'POST') return fail('Yalnızca POST kabul edilir.', 405)
      if (!env.LEDGER?.idFromName || !env.LEDGER?.get)
        return fail('quota_binding_missing', 503)
      const call = async (name, op, args) => {
        const obj = env.LEDGER.get(env.LEDGER.idFromName(name))
        const res = await obj.fetch('https://ledger.internal/', {
          method: 'POST',
          body: JSON.stringify({ op, args })
        })
        if (!res.ok) throw new Error('ledger')
        return res.json()
      }
      try {
        const ip = await digest(req.headers.get('CF-Connecting-IP') || 'local')
        if (!(await call('rate:' + ip, 'rate', {})))
          return fail('rate_limited', 429)
        let raw
        try {
          raw = await readLimited(req, 32768)
        } catch (e) {
          return fail(
            e === 413 ? 'İstek çok büyük.' : 'Geçersiz istek.',
            e === 413 ? 413 : 400
          )
        }
        let body
        try {
          body = JSON.parse(raw)
        } catch {
          return fail('Geçersiz istek.', 400)
        }
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return fail('Geçersiz istek.', 400)
        const id = req.headers.get('X-Install-Id')
        if (id !== null && !uuid.test(id || ''))
          return fail('Geçersiz kurulum kimliği.', 400)
        const install = id || 'legacy-' + ip
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        if (!text) return fail('Metin boş.', 400)
        if (text.length > limits.maxChars)
          return fail(`Metin en fazla ${limits.maxChars} karakter olabilir.`, 413)
        const mode =
          typeof body.mode === 'string' && Object.hasOwn(modes, body.mode)
            ? body.mode
            : 'fix'
        if (!env.AI_API_KEY) return fail('AI yapılandırması eksik.', 500)
        const ticket = crypto.randomUUID()
        let zone = req.headers.get('X-Time-Zone') || 'UTC'
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone })
        } catch {
          zone = 'UTC'
        }
        const quota = (op, success = false) =>
          call('quota:' + install, op, { install, ticket, zone, success })
        if (!(await quota('reserve')))
          return fail('quota_exceeded', 429)
        let result
        try {
          result = await generate(text, mode, env, send, body.allowFallback === true)
        } catch {
          result = { error: 'AI servisine ulaşılamadı.' }
        }
        await quota('finish', Boolean(result.result))
        return json(result, result.error ? 502 : 200)
      } catch {
        return fail('Sunucu işlemi tamamlayamadı.', 500)
      }
    }
  }
}
export default createWorker()
