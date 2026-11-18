import limits from '../../shared/limits.json' with { type: 'json' }

// One object per IP or installation. No user text enters this class.
export class Ledger {
  constructor(ctx, env) {
    this.ctx = ctx
    this.store = ctx.storage
    this.kv = env.KALEMIO_KV
  }
  async fetch(req) {
    const { op, args } = await req.json()
    const result = await this.ctx.blockConcurrencyWhile(() =>
      this.update(op, args)
    )
    return Response.json(result)
  }
  async update(op, a) {
    const now = Date.now()
    let state = await this.store.get('state')
    if (op === 'rate') {
      if (!state || state.until <= now) state = { used: 0, until: now + 60_000 }
      if (state.used >= 20) return false
      state.used++
      await this.store.put('state', state)
      await this.store.setAlarm(state.until)
      return true
    }
    if (op === 'reserve' || op === 'finish') {
      const zone = state?.zone || a.zone || 'UTC'
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(
        now
      )
      if (!state || state.day !== day)
        state = { kind: 'quota', zone, day, used: 0, pending: {} }
      for (const [id, expiry] of Object.entries(state.pending))
        if (expiry < now) delete state.pending[id]
      if (op === 'reserve') {
        if (state.used + Object.keys(state.pending).length >= limits.dailyLimit) return false
        state.pending[a.ticket] = now + 60_000
      } else if (state.pending[a.ticket]) {
        delete state.pending[a.ticket]
        if (a.success) {
          state.used++
          state.mirror = 'quota:' + a.install + ':' + day
          await this.store.put('mirror', {
            key: state.mirror,
            value: String(state.used),
            quota: true
          })
        }
      }
      await this.store.put('state', state)
      await this.store.setAlarm(now + 1500)
      return true
    }
    throw new Error('Unknown operation')
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const mirror = await this.store.get('mirror')
      if (mirror) {
        await this.kv.put(
          mirror.key,
          mirror.value,
          mirror.quota ? { expirationTtl: 172800 } : {}
        )
        await this.store.delete('mirror')
      }
      const state = await this.store.get('state')
      if (state?.until && state.until <= Date.now())
        await this.store.deleteAll()
      if (state?.kind === 'quota') {
        if (state.purgeAt && state.purgeAt <= Date.now() && !mirror)
          await this.store.deleteAll()
        else {
          state.purgeAt = Date.now() + 172800000
          await this.store.put('state', state)
          await this.store.setAlarm(state.purgeAt)
        }
      }
    })
  }
}
