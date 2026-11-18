import { config, type Mode } from '../config'
export class ApiError extends Error {
  constructor(public code: string) {
    super(code)
  }
}
export async function request(
  path: string,
  body: unknown,
  install: string
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeout)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Install-Id': install,
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone
    }
    const res = await fetch(config.worker + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 502 && data.status === 429) throw new ApiError('geminiLimit')
      if (res.status === 502 && data.status === 503) throw new ApiError('geminiBusy')
      if (data.detail || data.model)
        console.debug(
          'Kalemio',
          res.status,
          /^upstream_error$/.test(data.detail) ? data.detail : undefined,
          /^[\w.-]{1,100}$/.test(data.model || '') ? data.model : undefined
        )
      const code = [
        'edit_mismatch',
        'quota_exceeded',
        'rate_limited'
      ].includes(data.error)
        ? data.error
        : res.status === 413
          ? 'tooLong'
          : res.status === 403
            ? 'forbidden'
            : res.status >= 500
              ? 'server'
              : 'unexpected'
      throw new ApiError(code)
    }
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'offline')
  } finally {
    clearTimeout(timer)
  }
}
export async function edit(
  text: string,
  mode: Mode,
  install: string
): Promise<string> {
  if (!text.trim()) throw new ApiError('empty')
  if (text.length > config.maxChars) throw new ApiError('tooLong')
  const data = await request('/', { text, mode, allowFallback: true }, install)
  if (data.mode && data.mode !== mode) throw new ApiError('modeUnavailable')
  if (typeof data.result !== 'string' || !data.result.trim())
    throw new ApiError('unexpected')
  return data.result
}
