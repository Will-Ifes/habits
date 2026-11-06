import { copyFileSync, existsSync } from 'node:fs'
const target = new URL('../setup/aulas/server/.env', import.meta.url)
if (!existsSync(target)) {
  copyFileSync(new URL('../setup/aulas/server/.env.example', import.meta.url), target)
  console.log('Configuração local criada. O banco original dev.db foi preservado.')
}
