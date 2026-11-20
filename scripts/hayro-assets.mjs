#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const destination = resolve(process.argv[2] ?? 'public/hayro')
await mkdir(destination, { recursive: true })
await cp(new URL('../dist-lib/engine/', import.meta.url), destination, { recursive: true })

