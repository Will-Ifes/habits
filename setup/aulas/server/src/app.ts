import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from './generated/prisma/client'
import { ZodError } from 'zod'
import { registerRoutes } from './routes'
import staticFiles from '@fastify/static'

export function buildApp(db: PrismaClient, logger = false, webRoot?: string) {
  const app = Fastify({ logger })
  app.register(cors, {
    origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ message: error.issues[0]?.message || 'Dados inválidos.' })
    const status = (error as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ message: 'Requisição inválida.' })
    request.log.error(error)
    return reply
      .code(500)
      .send({ message: 'Não foi possível concluir a operação. Tente novamente.' })
  })
  app.register(async (instance) => registerRoutes(instance, db), { prefix: '/api' })
  if (webRoot) app.register(staticFiles, { root: webRoot, dotfiles: 'deny', cacheControl: false })
  return app
}
