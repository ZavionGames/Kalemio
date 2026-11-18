import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { zipSync } from 'fflate'
const files = {}
async function collect(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name),
      name = prefix + entry.name
    if (entry.isDirectory()) await collect(path, name + '/')
    else files[name] = new Uint8Array(await readFile(path))
  }
}
await collect('extension/dist')
await mkdir('release', { recursive: true })
await writeFile('release/kalemio-1.0.0.zip', zipSync(files, { level: 9 }))
console.log('release/kalemio-1.0.0.zip')
