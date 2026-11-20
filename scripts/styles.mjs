import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

await mkdir('dist-lib/engine', { recursive: true })
await copyFile('engine/prebuilt/hayro.wasm', 'dist-lib/engine/hayro.wasm')
await copyFile('engine/web/pdf.worker.mjs', 'dist-lib/engine/pdf.worker.mjs')
await copyFile('src/viewer/viewer.css', 'dist-lib/viewer.css')

const { name } = JSON.parse(await readFile('package.json', 'utf8'))
const entry = await readFile('dist-lib/index.js', 'utf8')
await writeFile('dist-lib/index.js', entry.replaceAll('@kyrven/react-pdf-viewer/', name + '/'))
