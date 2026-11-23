import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const engine = fileURLToPath(new URL('../engine/', import.meta.url))
const target = resolve(process.env.CARGO_TARGET_DIR || 'engine/target')

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`)
}

run(process.env.CARGO || 'cargo', ['build', '--locked', '--release', '--target', 'wasm32-unknown-unknown'], {
  cwd: engine, env: { ...process.env, CARGO_TARGET_DIR: target },
})

const assets = join(engine, 'prebuilt')
const input = join(target, 'wasm32-unknown-unknown/release/hayro_poc_engine.wasm')
await mkdir(assets, { recursive: true })
const temporary = await mkdtemp(join(assets, '.hayro-'))
try {
  const output = join(temporary, 'hayro.wasm')
  run(process.env.WASM_OPT || 'wasm-opt', [
    input,
    '--enable-simd', '--enable-bulk-memory-opt', '--enable-nontrapping-float-to-int', '--enable-sign-ext',
    '-Oz', '-o', output,
  ])
  await rename(output, join(assets, 'hayro.wasm'))
} finally {
  await rm(temporary, { recursive: true, force: true })
}



