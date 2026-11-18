import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { createServer } from 'node:http'
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright-core'
import { runtime } from '../backend/tests/runtime.mjs'

const tmp = await mkdtemp(join(tmpdir(), 'kalemio-browser-')),
  ext = join(tmp, 'extension')
let browser, server, worker
try {
  const testKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({format:'der', type:'spki'})
  const testId = createHash('sha256').update(testKey).digest('hex').slice(0,32)
    .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit,16)))
  let releaseResponse
  const firstResponse = new Promise(resolve => { releaseResponse = resolve })
  worker = await runtime('chrome-extension://' + testId, () => firstResponse)
  assert.equal((await worker.post('/', { text: 'deneme' })).status, 403)
  const local = await worker.mf.ready
  const fixture = await readFile('docs/test-editor.html')
  server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(fixture)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  await cp(resolve('extension/dist'), ext, { recursive: true })
  const manifest = JSON.parse(
    await readFile(join(ext, 'manifest.json'), 'utf8')
  )
  const original = new URL(manifest.host_permissions[0]).origin
  manifest.host_permissions = [local.origin + '/*']
  manifest.key = testKey.toString('base64')
  await writeFile(join(ext, 'manifest.json'), JSON.stringify(manifest))
  const bg = join(ext, 'background.js')
  assert.ok((await readFile(bg, 'utf8')).includes(original))
  await writeFile(
    bg,
    (await readFile(bg, 'utf8')).replaceAll(original, local.origin)
  )
  browser = await chromium.launchPersistentContext(join(tmp, 'profile'), {
    executablePath:
      process.env.KALEMIO_TEST_CHROME || chromium.executablePath(),
    headless: true,
    args: [
      '--disable-extensions-except=' + ext,
      '--load-extension=' + ext,
      '--disable-background-networking',
      '--no-first-run'
    ],
    viewport: { width: 1000, height: 920 }
  })
  const service =
    browser.serviceWorkers()[0] ||
    (await browser.waitForEvent('serviceworker', { timeout: 15000 }))
  const id = new URL(service.url()).hostname
  await service.evaluate(origin => {
    globalThis.editRequests = 0
    const send = globalThis.fetch
    globalThis.fetch = (...args) => {
      if (String(args[0]) === origin + '/' && args[1]?.method === 'POST') globalThis.editRequests++
      return send(...args)
    }
  }, local.origin)
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://127.0.0.1:' + server.address().port)
  const cdp = await browser.newCDPSession(page)
  const tr = (key) => service.evaluate((k) => chrome.i18n.getMessage(k), key)
  async function findButton(match, click = true) {
    const until = Date.now() + 12000
    while (Date.now() < until) {
      const { root } = await cdp.send('DOM.getDocument', {
        depth: -1,
        pierce: true
      })
      function walk(n) {
        if (n.localName === 'button' && match(n)) return n
        for (const child of [...(n.children || []), ...(n.shadowRoots || [])]) {
          const found = walk(child)
          if (found) return found
        }
      }
      const n = walk(root)
      if (n) {
        if (!click) return n
        const { object } = await cdp.send('DOM.resolveNode', {
          nodeId: n.nodeId
        })
        const { result } = await cdp.send('Runtime.callFunctionOn', {
          objectId: object.objectId,
          functionDeclaration:
            'function(){this.scrollIntoView({block:"nearest"});const b=this.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}',
          returnByValue: true
        })
        await page.mouse.click(...result.value)
        return n
      }
      await sleep(70)
    }
    throw new Error('Button unavailable: ' + match.toString())
  }
  const button = async (key) => {
    const label = await tr(key)
    return findButton((n) => n.children?.some((c) => c.nodeValue === label))
  }
  const pin = () => findButton((n) => n.attributes?.includes('pin'))
  const prompt = 'bugun hava cok guzel ama yinede disari cikmak istemiyorum'
  const answer = 'Bugün hava çok güzel ama yine de dışarı çıkmak istemiyorum.'
  const area = page.locator('#plain')
  // A modal compose surface sits above document-level overlays, even at maximum z-index.
  await page.evaluate(() => {
    const dialog = document.createElement('dialog')
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    editor.style.cssText = 'width:420px;height:160px'
    editor.textContent = 'turkce yazim'
    dialog.append(editor)
    document.body.append(dialog)
    dialog.showModal()
    editor.focus()
    editor.textContent = ''
    const dismissEditor = (event) => {
      if (!editor.contains(event.target)) dialog.close()
    }
    document.addEventListener('pointerdown', dismissEditor)
    dialog.addEventListener('close', () => document.removeEventListener('pointerdown', dismissEditor), {once:true})
  })
  await page.keyboard.type('turkce yazim')
  await pin()
  await button('fix')
  await button('cancel')
  assert.equal(worker.calls.length, 0)
  await page.evaluate(() => document.querySelector('dialog').close())
  await page.evaluate(() => {
    const frame = document.createElement('iframe')
    frame.src = '/editor'
    document.body.prepend(frame)
  })
  const framed = page.frameLocator('iframe')
  await framed.locator('#plain').fill('turkce yazim')
  await framed.locator('kalemio-assistant').waitFor({state:'attached'})
  await page.evaluate(() => document.querySelector('iframe').remove())
  console.log('OK · compose dialog and same-origin embedded editor')
  await area.fill(prompt)
  await findButton((n) => n.attributes?.includes('bugun'), false)
  assert.equal(worker.calls.length, 0)
  await pin()
  await button('fix')
  await button('cancel')
  assert.equal(worker.calls.length, 0)
  await pin()
  await button('fix')
  await button('allow')
  for (let n = 0; n < 100 && !worker.calls.length; n++) await sleep(50)
  assert.equal(worker.calls.length, 1)
  try {
    await area.click({position:{x:10,y:10}})
    await service.evaluate(async () => {
      const [tab] = await chrome.tabs.query({active:true,currentWindow:true})
      for (let n = 0; n < 6; n++) await chrome.tabs.sendMessage(tab.id, {action:'fix'}, {frameId:0})
    })
  } finally {
    releaseResponse()
  }
  await button('apply')
  assert.equal(await area.inputValue(), answer)
  await button('undo')
  assert.equal(await area.inputValue(), prompt)
  const measured = await service.evaluate(async () => ({
    posts: globalThis.editRequests,
    ...await chrome.storage.local.get(['installId','usage'])
  }))
  assert.equal(measured.posts, 1)
  assert.equal(worker.calls.length, 1)
  assert.equal(measured.usage.used, 1)
  const kv = await worker.mf.getKVNamespace('KALEMIO_KV')
  const quotaKey = 'quota:' + measured.installId + ':' + measured.usage.day
  let serverUsage
  for (let n = 0; n < 50 && !serverUsage; n++) {
    serverUsage = await kv.get(quotaKey)
    if (!serverUsage) await sleep(100)
  }
  assert.equal(serverUsage, '1')
  console.log('OK · six repeated actions in flight: one POST, one model call, one local and server quota unit')
  console.log('OK · offline spelling, consent, AI preview, apply, undo')
  const rich = page.locator('#rich')
  await rich.click()
  await page.evaluate(() => {
    const node = document.querySelector('#rich').lastChild,
      r = document.createRange()
    r.setStart(node, 1)
    r.setEnd(node, node.length)
    getSelection().removeAllRanges()
    getSelection().addRange(r)
  })
  await pin()
  await button('fix')
  await button('apply')
  assert.equal(
    (await rich.textContent()).replaceAll('\u00a0', ' '),
    'Merhaba ' + answer
  )
  assert.equal(await rich.locator('b').textContent(), 'Merhaba')
  await button('undo')
  assert.equal(await rich.textContent(), 'Merhaba dünya')
  const short = page.locator('#short')
  await short.fill('turkce')
  await findButton((n) => n.attributes?.includes('turkce'))
  await findButton((n) => n.children?.some((c) => c.nodeValue === 'Türkçe'))
  assert.equal(await short.inputValue(), 'Türkçe')
  console.log('OK · rich selection, formatting, native undo, input accent')
  for (const selector of ['#password', '#otp', '#card', '#billing-note']) {
    await page.locator(selector).focus()
    await page.waitForFunction(
      () => !document.querySelector('kalemio-assistant')
    )
  }
  const options = await browser.newPage()
  await options.goto('chrome-extension://' + id + '/options.html')
  assert.equal(await options.locator('input[type=checkbox]').count(), 0)
  await options.locator('#word').fill('Kalemiom')
  await options.getByRole('button', { name: await tr('add') }).click()
  await options.getByText('kalemiom', { exact: false }).first().waitFor()
  await page.bringToFront()
  await area.fill('bir deneme')
  await pin()
  await button('formal')
  await button('cancel')
  assert.deepEqual(errors, [])
  console.log('OK · sensitive controls, personal dictionary and formal editing')
  // Starting at the allowance boundary keeps this browser check independent of IP throttling.
  // The integration suite sends all ten real requests and checks concurrent reservations.
  await service.evaluate(async () => {
    const date = new Date(),
      day = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-')
    await chrome.storage.local.set({ usage: { day, used: 10 } })
  })
  await page.bringToFront()
  await area.fill(prompt)
  const count = worker.calls.length
  await pin()
  await button('fix')
  await button('dismiss')
  assert.equal(worker.calls.length, count)
  await area.focus()
  await page.keyboard.press('Control+Alt+d')
  await page.keyboard.press('Control+Alt+f')
  const usageAfterKeys = await service.evaluate(() => chrome.storage.local.get('usage'))
  assert.equal(usageAfterKeys.usage.used, 10)
  await service.evaluate(() => chrome.storage.local.remove('usage'))
  await area.fill('a'.repeat(4001))
  await pin()
  await button('fix')
  await button('dismiss')
  assert.equal(worker.calls.length, count)
  await area.fill(prompt)
  await options.bringToFront()
  await options.getByRole('button', { name: await tr('revoke') }).click()
  await page.bringToFront()
  await area.focus()
  await pin()
  await button('fix')
  await button('cancel')
  assert.equal(worker.calls.length, count)
  const popup = await browser.newPage()
  await popup.goto('chrome-extension://' + id + '/popup.html')
  await popup.getByRole('heading', { name: await tr('today') }).waitFor()
  await options.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'site', host: '127.0.0.1', block: true })
  )
  await page.bringToFront()
  await area.focus()
  await page.waitForFunction(() => !document.querySelector('kalemio-assistant'))
  await options.evaluate(() =>
    chrome.runtime.sendMessage({
      type: 'site',
      host: '127.0.0.1',
      block: false
    })
  )
  await page.waitForSelector('kalemio-assistant', { state: 'attached' })
  console.log(
    'OK · quota UI, length guard, withdrawal, popup, per-site controls'
  )
  await worker.mf.dispose()
  worker = undefined
  await pin()
  await button('fix')
  await button('allow')
  await button('dismiss')
  assert.equal(await area.inputValue(), prompt)
  const usage = await service.evaluate(() => chrome.storage.local.get('usage'))
  assert.equal(usage.usage, undefined)
  console.log('OK · unreachable service leaves text and allowance intact')
} finally {
  await browser?.close()
  server?.close()
  await worker?.mf.dispose()
  await rm(tmp, { recursive: true, force: true, maxRetries: 3 })
}
