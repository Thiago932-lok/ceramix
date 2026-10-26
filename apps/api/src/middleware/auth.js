import jwt from 'jsonwebtoken'
import db from '../db/connection.js'
import { config } from '../config.js'

export function authenticate(req, res, next) {
  const header = req.headers.authorization
  const cookieToken = req.cookies?.access_token
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken

  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' })
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const user = db
      .prepare(
        `
      SELECT u.id, u.empresa_id, u.nome, u.login, u.perfil, u.ativo, e.nome AS empresa_nome
      FROM usuarios u
      JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = ?
    `
      )
      .get(payload.sub)

    if (!user || !user.ativo) {
      return res.status(401).json({ erro: 'Usuário inativo ou inexistente' })
    }

    if (payload.dispositivo_id) {
      const dispositivo = db
        .prepare('SELECT id, revogado FROM dispositivos WHERE id = ?')
        .get(payload.dispositivo_id)
      if (dispositivo?.revogado) {
        return res.status(401).json({ erro: 'Dispositivo revogado' })
      }
    }

    req.user = {
      id: user.id,
      empresaId: user.empresa_id,
      empresaNome: user.empresa_nome,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil
    }
    req.dispositivoId = payload.dispositivo_id || null
    return next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}
