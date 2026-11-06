import 'dotenv/config'
import { createDatabase } from './database'
export const prisma = createDatabase()
