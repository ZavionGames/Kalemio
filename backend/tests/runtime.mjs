import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { randomUUID } from 'node:crypto'
export async function runtime(allowedOrigin = '', beforeAnswer = () => {}) {
  const code = await build({
    entryPoints: ['backend/src/index.js'],
    bundle: true,
    format: 'esm',
    write: false
  })
  const secondKey = randomUUID()
  const calls = []
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: code.outputFiles[0].text,
    compatibilityDate: '2025-11-01',
    log: new Log(LogLevel.ERROR),
    kvNamespaces: ['KALEMIO_KV'],
    durableObjects: { LEDGER: { className: 'Ledger', useSQLite: true } },
    bindings: {
      ALLOWED_ORIGIN: allowedOrigin,
      AI_API_KEY: randomUUID(),
      AI_API_KEY_2: secondKey,
      GEMINI_MODEL_2: 'test-second-model',
      OPENROUTER_API_KEY: randomUUID(),
      GROQ_API_KEY: randomUUID()
    },
    outboundService: async (req) => {
      const payload = await req.json()
      if (new URL(req.url).hostname === 'api.groq.com') {
        calls.push(payload.model)
        if (JSON.parse(payload.messages.at(-1).content).source === 'groq succeeds')
          return Response.json({choices:[{finish_reason:'stop',message:{content:'İkinci yanıt.'}}]})
        return new Response(null,{status:429})
      }
      if (new URL(req.url).hostname === 'openrouter.ai') {
        calls.push(payload.model)
        if (JSON.parse(payload.messages.at(-1).content).source === 'both unavailable')
          return new Response(null, { status: 503 })
        return Response.json({choices:[{finish_reason:'stop', message:{content:'Yedek yanıt.'}}]})
      }
      const
        text = JSON.parse(payload.contents[0].parts[0].text).source
      const second = req.headers.get('x-goog-api-key') === secondKey
      if (second && !new URL(req.url).pathname.endsWith('/test-second-model:generateContent')) throw new Error('Wrong second model')
      calls.push(second ? 'gemini2' : payload.contents.length)
      await beforeAnswer()
      if ((!second && text === 'second succeeds') || ['upstream failure','both unavailable','groq succeeds'].includes(text))
        return new Response(null, { status: 503 })
      const answer = payload.generationConfig.responseMimeType
        ? JSON.stringify({
            readability: 'Kolay',
            averageSentenceLength: 4,
            repeatedWords: [],
            suggestions: []
          })
        : 'Bugün hava çok güzel ama yine de dışarı çıkmak istemiyorum.'
      return Response.json({
        candidates: [
          { content: { parts: [{ text: answer }] }, finishReason: 'STOP' }
        ]
      })
    }
  })
  )
  await mf.ready
  const post = (path, body, headers = {}) =>
    mf.dispatchFetch('http://kalemio.test' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  return { mf, post, calls }
}
