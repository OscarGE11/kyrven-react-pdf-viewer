import { spawnSync } from 'node:child_process'
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const engine = fileURLToPath(new URL('../engine/', import.meta.url))
const target = resolve(process.env.CARGO_TARGET_DIR || 'engine/target')
const result = spawnSync(process.env.CARGO || 'cargo',
  ['build', '--locked', '--release', '--target', 'wasm32-unknown-unknown'], {
    cwd: engine, env: { ...process.env, CARGO_TARGET_DIR: target }, stdio: 'inherit',
  })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
const assets = new URL('../engine/prebuilt/', import.meta.url)
await mkdir(assets, { recursive: true })
await cp(resolve(target, 'wasm32-unknown-unknown/release/hayro_poc_engine.wasm'),
  new URL('hayro.wasm', assets))



