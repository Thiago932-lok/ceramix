export class AppError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem)
    this.name = 'AppError'
    this.status = status
    this.detalhes = detalhes
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

export function notFound(req, res) {
  res.status(404).json({
    erro: 'Rota não encontrada',
    metodo: req.method,
    caminho: req.originalUrl
  })
}
