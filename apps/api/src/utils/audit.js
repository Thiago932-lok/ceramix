import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'

export function audit({
  empresaId,
  entidade,
  entidadeId,
  acao,
  usuarioId,
  dispositivoId,
  valorAntigo,
  valorNovo,
  ip
}) {
  db.prepare(
    `
    INSERT INTO auditoria (id, empresa_id, entidade, entidade_id, acao, usuario_id, dispositivo_id, valor_antigo, valor_novo, ip, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    uuid(),
    empresaId,
    entidade,
    entidadeId,
    acao,
    usuarioId || null,
    dispositivoId || null,
    valorAntigo ? JSON.stringify(valorAntigo) : null,
    valorNovo ? JSON.stringify(valorNovo) : null,
    ip || null,
    new Date().toISOString()
  )
}
