import { createApp } from './app.js'
import { config } from './config.js'
import { logger } from './logger.js'
import db from './db/connection.js'

const app = createApp()
const server = app.listen(config.port, () => {
  logger.info({ porta: config.port, ambiente: config.env }, 'Ceramix API iniciada')
})

function encerrar(sinal) {
  logger.info({ sinal }, 'Encerrando servidor')
  server.close(() => {
    try {
      db.close()
    } catch {
      // banco já encerrado
    }
    logger.info('Servidor encerrado com sucesso')
    process.exit(0)
  })
  setTimeout(() => {
    logger.error('Encerramento forçado após timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGINT', () => encerrar('SIGINT'))
process.on('SIGTERM', () => encerrar('SIGTERM'))

export { app, server }
