export async function message<T = void>(
  type: string,
  values: Record<string, unknown> = {}
): Promise<T> {
  const runtime = globalThis.chrome?.runtime
  if (!runtime?.id || typeof runtime.sendMessage !== 'function')
    throw new Error('reloadTab')
  let reply
  try {
    reply = await runtime.sendMessage({ type, ...values })
  } catch (error) {
    if (!globalThis.chrome?.runtime?.id || /extension context invalidated/i.test(String(error)))
      throw new Error('reloadTab')
    throw new Error('unexpected')
  }
  if (!reply?.ok) throw new Error(reply?.error || 'unexpected')
  return reply.data
}
