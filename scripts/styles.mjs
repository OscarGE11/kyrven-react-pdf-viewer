import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('dist-lib/engine', { recursive: true })
await copyFile('engine/prebuilt/hayro.wasm', 'dist-lib/engine/hayro.wasm')
await copyFile('engine/web/pdf.worker.mjs', 'dist-lib/engine/pdf.worker.mjs')
await copyFile('src/viewer/viewer.css', 'dist-lib/viewer.css')
