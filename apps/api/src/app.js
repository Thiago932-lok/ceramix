import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { config } from './config.js'
import { logger } from './logger.js'
import db from './db/connection.js'
import authRoutes from './routes/auth.js'
import catalogRoutes from './routes/catalog.js'
import producaoRoutes from './routes/producao.js'
import entregaRoutes from './routes/entrega.js'
import syncRoutes from './routes/sync.js'
import relatoriosRoutes from './routes/relatorios.js'
import { AppError, notFound } from './utils/http.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers['x-request-id'] || crypto.randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode })
      }
    })
  )

  app.use(helmet())
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true)
        return callback(new AppError(403, 'Origem não permitida pelo CORS'))
      },
      credentials: true
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  if (!config.isTest) {
    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        max: config.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { erro: 'Muitas requisições. Tente novamente em instantes.' }
      })
    )
  }

  app.get('/api/health', (_req, res) => {
    let banco = 'ok'
    try {
      db.prepare('SELECT 1').get()
    } catch {
      banco = 'indisponivel'
    }
    res.status(banco === 'ok' ? 200 : 503).json({
      ok: banco === 'ok',
      servico: 'ceramix-api',
      versao: pkg.version,
      ambiente: config.env,
      banco,
      uptime_s: Math.round(process.uptime()),
      em: new Date().toISOString()
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/catalogo', catalogRoutes)
  app.use('/api/producoes', producaoRoutes)
  app.use('/api/entregas', entregaRoutes)
  app.use('/api/sync', syncRoutes)
  app.use('/api/relatorios', relatoriosRoutes)

  app.use(notFound)

  app.use((err, req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' })
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ erro: 'Corpo da requisição excede 1 MB' })
    }
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ erro: 'Registro duplicado' })
    }

    const status = err instanceof AppError ? err.status : err?.status || 500
    if (status >= 500) {
      req.log?.error({ err }, 'Erro não tratado')
      return res.status(status).json({
        erro: 'Erro interno do servidor',
        requisicao_id: req.id
      })
    }

    return res.status(status).json({
      erro: err.message || 'Requisição inválida',
      ...(err.detalhes ? { detalhes: err.detalhes } : {})
    })
  })

  return app
}
