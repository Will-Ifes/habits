import 'dotenv/config'
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.env.DATABASE_URL
if (!url?.startsWith('file:'))
  throw new Error('DATABASE_URL deve apontar para um arquivo SQLite (file:...).')
const file = url.startsWith('file://') ? fileURLToPath(url) : resolve(url.slice(5))
// On Windows migrate deploy may fail without creating an absent SQLite file.
if (!existsSync(file)) {
  mkdirSync(dirname(file), { recursive: true })
  closeSync(openSync(file, 'wx'))
}
