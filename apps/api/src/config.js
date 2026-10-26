import 'dotenv/config'
import { z } from 'zod'

const isProduction = process.env.NODE_ENV === 'production'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter ao menos 32 caracteres'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().max(1440).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(90).default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DB_PATH: z.string().default('./data/ceramix.db'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300)
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  console.error(`Configuração de ambiente inválida:\n${detalhes}`)
  process.exit(1)
}

const env = parsed.data

if (isProduction) {
  const inseguros = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((chave) =>
    /dev|troque|secret|changeme/i.test(env[chave])
  )
  if (inseguros.length > 0) {
    console.error(`Defina segredos fortes em produção: ${inseguros.join(', ')}`)
    process.exit(1)
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    console.error('JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes')
    process.exit(1)
  }
}

export const config = {
  env: env.NODE_ENV,
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  trustProxy: env.TRUST_PROXY,
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  accessTokenMinutes: env.ACCESS_TOKEN_MINUTES,
  refreshTokenDays: env.REFRESH_TOKEN_DAYS,
  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((origem) => origem.trim())
    .filter(Boolean),
  dbPath: env.DB_PATH,
  rateLimitMax: env.RATE_LIMIT_MAX
}
