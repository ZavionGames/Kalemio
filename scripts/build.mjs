import { build as viteBuild } from 'vite'
import { build, context } from 'esbuild'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { zlibSync } from 'fflate'
const dev = process.argv.includes('--dev'),
  watch = process.argv.includes('--watch')
const root = resolve('extension'),
  outdir = resolve(root, 'dist')
await viteBuild({
  configFile: false,
  root,
  build: {
    modulePreload: false,
    outDir: outdir,
    emptyOutDir: !watch,
    watch: watch ? {} : null,
    rollupOptions: {
      input: [resolve(root, 'popup.html'), resolve(root, 'options.html')]
    }
  }
})
const entries = ['background', 'content', 'offscreen', 'spell-worker']
for (const name of entries) {
  const opt = {
    entryPoints: [resolve(root, 'src', name + '.ts')],
    outfile: resolve(outdir, name + '.js'),
    bundle: true,
    format: 'iife',
    target: 'chrome116',
    minify: !dev,
    loader: { '.aff': 'text', '.dic': 'text' },
    plugins: [
      {
        name: 'inline-css',
        setup(b) {
          b.onResolve({ filter: /^dictionary-tr\/index\.(aff|dic)$/ }, (a) => ({
            path: resolve('node_modules', a.path)
          }))
          b.onResolve({ filter: /\.css\?inline$/ }, (a) => ({
            path: resolve(a.resolveDir, a.path.replace('?inline', '')),
            namespace: 'inline-css'
          }))
          b.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (a) => ({
            contents: await readFile(a.path, 'utf8'),
            loader: 'text',
            watchFiles: [a.path]
          }))
        }
      }
    ]
  }
  if (watch) {
    const runner = await context(opt)
    await runner.watch()
  } else await build(opt)
}
const cfg = await build({
  entryPoints: ['extension/src/config.ts'],
  write: false,
  bundle: true,
  format: 'esm'
})
const { config } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(cfg.outputFiles[0].contents).toString('base64')
)
const icons = {}
await mkdir(resolve(outdir, 'icons'), { recursive: true })
function chunk(tag, data) {
  const b = Buffer.concat([Buffer.from(tag), data])
  let crc = -1
  for (const v of b) {
    crc ^= v
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const len = Buffer.alloc(4),
    sum = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  sum.writeUInt32BE((crc ^ -1) >>> 0)
  return Buffer.concat([len, b, sum])
}
for (const size of [16, 32, 48, 128]) {
  const scan = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size,
        v = (y + 0.5) / size,
        pos = y * (1 + size * 4) + 1 + 4 * x
      const stroke =
        (u > 0.27 && u < 0.39 && v > 0.2 && v < 0.8) ||
        (u > 0.37 && u < 0.76 && Math.abs(v - (0.94 - u)) < 0.075) ||
        (u > 0.39 && u < 0.75 && Math.abs(v - (u + 0.08)) < 0.075)
      const dx = Math.max(0.2 - u, 0, u - 0.8),
        dy = Math.max(0.2 - v, 0, v - 0.8)
      scan.set(
        stroke
          ? [243, 246, 227, 255]
          : [
              22,
              89,
              77,
              Math.round(
                255 *
                  Math.min(1, Math.max(0, (0.2 - Math.hypot(dx, dy)) * size))
              )
            ],
        pos
      )
    }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(size)
  head.writeUInt32BE(size, 4)
  head[8] = 8
  head[9] = 6
  icons[size] = 'icons/' + size + '.png'
  await writeFile(
    resolve(outdir, icons[size]),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', head),
      chunk('IDAT', Buffer.from(zlibSync(scan))),
      chunk('IEND', Buffer.alloc(0))
    ])
  )
}
const manifest = {
  manifest_version: 3,
  name: '__MSG_name__',
  description: '__MSG_description__',
  version: '1.0.0',
  minimum_chrome_version: '116',
  default_locale: 'tr',
  permissions: ['storage', 'activeTab', 'contextMenus', 'offscreen'],
  host_permissions: [config.worker + '/*'],
  background: { service_worker: 'background.js' },
  action: { default_popup: 'popup.html', default_icon: icons },
  icons,
  options_page: 'options.html',
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['content.js'],
      all_frames: true,
      run_at: 'document_idle'
    }
  ],
  commands: {
    'open-menu': {
      suggested_key: { default: 'Alt+Shift+K' },
      description: '__MSG_shortcutLabel__'
    }
  }
}
await writeFile(
  resolve(outdir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
)
await mkdir(resolve(outdir, 'licenses'), { recursive: true })
for (const [pkg, file] of [
  ['dictionary-tr', 'license'],
  ['react', 'LICENSE'],
  ['react-dom', 'LICENSE'],
  ['scheduler', 'LICENSE'],
  ['diff', 'LICENSE']
])
  await copyFile(
    resolve('node_modules', pkg, file),
    resolve(outdir, 'licenses', pkg + '.txt')
  )
console.log('Kalemio → ' + outdir)
