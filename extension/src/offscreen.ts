let worker: Worker | undefined
let next = 0
const pending = new Map<number, (value: unknown) => void>()
let idle: ReturnType<typeof setTimeout>
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.target !== 'dictionary') return
  if (!worker) {
    worker = new Worker('spell-worker.js')
    worker.onmessage = ({ data }) => {
      pending.get(data.id)?.(data)
      pending.delete(data.id)
    }
    worker.onerror = () => {
      for (const reply of pending.values()) reply({ error: 'dictionary' })
      pending.clear()
      worker?.terminate()
      worker = undefined
    }
  }
  clearTimeout(idle)
  const id = ++next
  pending.set(id, respond)
  worker.postMessage({ ...msg, id })
  idle = setTimeout(() => {
    if (!pending.size) {
      worker?.terminate()
      worker = undefined
    }
  }, 120000)
  return true
})
