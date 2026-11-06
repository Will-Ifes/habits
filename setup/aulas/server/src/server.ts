import 'dotenv/config'
import { prisma } from './lib/prisma'
import { buildApp } from './app'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const webRoot = resolve(__dirname, '../../web/dist')
const app = buildApp(prisma, true, existsSync(webRoot) ? webRoot : undefined)
async function close() {
  await app.close()
  await prisma.$disconnect()
}
process.once('SIGINT', () => {
  void close()
})
process.once('SIGTERM', () => {
  void close()
})
app
  .listen({ port: Number(process.env.PORT || 3333), host: process.env.HOST || '127.0.0.1' })
  .catch(async (error) => {
    app.log.error(error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
