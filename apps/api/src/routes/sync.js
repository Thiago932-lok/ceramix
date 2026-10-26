import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { requirePerm } from '../utils/permissions.js'
import { criarProducao, producaoSchema } from './producao.js'
import { criarEntrega, entregaSchema } from './entrega.js'

const router = Router()
router.use(authenticate)
router.use(requirePerm('sync.enviar'))

function logSync({ empresaId, dispositivoId, tipo, registroId, status, erro }) {
  db.prepare(
    `
    INSERT INTO log_sincronizacao (id, empresa_id, dispositivo_id, registro_tipo, registro_id, status, tentativas, erro, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `
  ).run(
    uuid(),
    empresaId,
    dispositivoId || null,
    tipo,
    registroId,
    status,
    erro || null,
    new Date().toISOString()
  )
}

router.post('/batch', (req, res) => {
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : []
  if (itens.length === 0) {
    return res.status(400).json({ erro: 'Nenhum item para sincronizar' })
  }
  if (itens.length > 100) {
    return res.status(400).json({ erro: 'Limite de 100 itens por lote' })
  }

  const resultados = []

  for (const item of itens) {
    const tipo = item?.tipo
    const dados = item?.dados

    if (!tipo || !dados) {
      resultados.push({ id: item?.id || null, status: 'REJEITADO', erro: 'Item invalido' })
      continue
    }

    if (tipo === 'producao') {
      const parsed = producaoSchema.safeParse(dados)
      if (!parsed.success) {
        const status = 'REJEITADO'
        const erro = 'Payload de producao invalido'
        logSync({
          empresaId: req.user.empresaId,
          dispositivoId: req.dispositivoId,
          tipo,
          registroId: dados?.id || 'desconhecido',
          status,
          erro
        })
        resultados.push({ id: dados?.id, tipo, status, erro })
        continue
      }
      const result = criarProducao(parsed.data, req.user, req.dispositivoId)
      logSync({
        empresaId: req.user.empresaId,
        dispositivoId: req.dispositivoId,
        tipo,
        registroId: parsed.data.id,
        status: result.status,
        erro: result.erro
      })
      resultados.push({ id: parsed.data.id, tipo, ...result })
      continue
    }

    if (tipo === 'entrega') {
      const parsed = entregaSchema.safeParse(dados)
      if (!parsed.success) {
        const status = 'REJEITADO'
        const erro = 'Payload de entrega invalido'
        logSync({
          empresaId: req.user.empresaId,
          dispositivoId: req.dispositivoId,
          tipo,
          registroId: dados?.id || 'desconhecido',
          status,
          erro
        })
        resultados.push({ id: dados?.id, tipo, status, erro })
        continue
      }
      const result = criarEntrega(parsed.data, req.user, req.dispositivoId)
      logSync({
        empresaId: req.user.empresaId,
        dispositivoId: req.dispositivoId,
        tipo,
        registroId: parsed.data.id,
        status: result.status,
        erro: result.erro
      })
      resultados.push({ id: parsed.data.id, tipo, ...result })
      continue
    }

    resultados.push({
      id: dados?.id,
      tipo,
      status: 'REJEITADO',
      erro: `Tipo nao suportado: ${tipo}`
    })
  }

  res.json({
    processados: resultados.length,
    resultados,
    servidor_em: new Date().toISOString()
  })
})

export default router
