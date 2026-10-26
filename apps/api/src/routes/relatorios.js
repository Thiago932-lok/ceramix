import { Router } from 'express'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { requirePerm } from '../utils/permissions.js'
import { audit } from '../utils/audit.js'

const router = Router()
router.use(authenticate)
router.use(requirePerm('dashboard.ver'))

router.get('/dashboard', (req, res) => {
  const empresaId = req.user.empresaId
  const de = req.query.de || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const ate = req.query.ate || new Date().toISOString().slice(0, 10)

  const producao = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(i.quantidade_produzida), 0) as total_produzido,
      COALESCE(SUM(i.quantidade_refugo), 0) as total_refugo,
      COALESCE(SUM(i.consumo_argila), 0) as total_argila,
      COUNT(DISTINCT p.id) as registros
    FROM producoes p
    JOIN itens_producao i ON i.producao_id = p.id
    WHERE p.empresa_id = ?
      AND p.status = 'validado'
      AND p.data_producao BETWEEN ? AND ?
  `
    )
    .get(empresaId, de, ate)

  const pendentesValidacao = db
    .prepare(
      `
    SELECT COUNT(*) as total FROM producoes
    WHERE empresa_id = ? AND status = 'pendente_validacao'
      AND data_producao BETWEEN ? AND ?
  `
    )
    .get(empresaId, de, ate)

  const meta = db
    .prepare(
      `
    SELECT COALESCE(SUM(meta_diaria), 0) as meta_diaria
    FROM metas_producao
    WHERE empresa_id = ? AND ativo = 1
  `
    )
    .get(empresaId)

  const dias = Math.max(1, Math.ceil((Date.parse(ate) - Date.parse(de)) / 86400000) + 1)
  const metaPeriodo = meta.meta_diaria * dias
  const boas = producao.total_produzido - producao.total_refugo
  const pctMeta = metaPeriodo > 0 ? Math.round((boas / metaPeriodo) * 1000) / 10 : 0
  const pctPerdas =
    producao.total_produzido > 0
      ? Math.round((producao.total_refugo / producao.total_produzido) * 1000) / 10
      : 0
  const argilaPorPeca = boas > 0 ? Math.round((producao.total_argila / boas) * 1000) / 1000 : 0

  const porMotivo = db
    .prepare(
      `
    SELECT m.nome, SUM(i.quantidade_refugo) as total
    FROM itens_producao i
    JOIN producoes p ON p.id = i.producao_id
    JOIN motivos_refugo m ON m.id = i.motivo_refugo_id
    WHERE p.empresa_id = ? AND p.status = 'validado'
      AND p.data_producao BETWEEN ? AND ?
      AND i.quantidade_refugo > 0
    GROUP BY m.nome
    ORDER BY total DESC
  `
    )
    .all(empresaId, de, ate)

  const porProduto = db
    .prepare(
      `
    SELECT pr.nome,
      SUM(i.quantidade_produzida) as produzido,
      SUM(i.quantidade_refugo) as refugo
    FROM itens_producao i
    JOIN producoes p ON p.id = i.producao_id
    JOIN produtos pr ON pr.id = i.produto_id
    WHERE p.empresa_id = ? AND p.status = 'validado'
      AND p.data_producao BETWEEN ? AND ?
    GROUP BY pr.nome
    ORDER BY produzido DESC
  `
    )
    .all(empresaId, de, ate)

  const porTurno = db
    .prepare(
      `
    SELECT t.nome,
      SUM(i.quantidade_produzida) as produzido,
      SUM(i.quantidade_refugo) as refugo
    FROM itens_producao i
    JOIN producoes p ON p.id = i.producao_id
    JOIN turnos t ON t.id = p.turno_id
    WHERE p.empresa_id = ? AND p.status = 'validado'
      AND p.data_producao BETWEEN ? AND ?
    GROUP BY t.nome
    ORDER BY produzido DESC
  `
    )
    .all(empresaId, de, ate)

  const evolucao = db
    .prepare(
      `
    SELECT p.data_producao as data,
      SUM(i.quantidade_produzida) as produzido,
      SUM(i.quantidade_refugo) as refugo
    FROM itens_producao i
    JOIN producoes p ON p.id = i.producao_id
    WHERE p.empresa_id = ? AND p.status = 'validado'
      AND p.data_producao BETWEEN ? AND ?
    GROUP BY p.data_producao
    ORDER BY p.data_producao
  `
    )
    .all(empresaId, de, ate)

  const entregas = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues,
      SUM(CASE WHEN status = 'saida_registrada' OR status = 'em_transito' THEN 1 ELSE 0 END) as pendentes,
      SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END) as canceladas
    FROM entregas
    WHERE empresa_id = ?
      AND date(recebido_em_servidor) BETWEEN ? AND ?
  `
    )
    .get(empresaId, de, ate)

  const entregasPorObra = db
    .prepare(
      `
    SELECT o.nome, COUNT(*) as total
    FROM entregas e
    JOIN obras o ON o.id = e.obra_id
    WHERE e.empresa_id = ? AND e.status != 'cancelada'
      AND date(e.recebido_em_servidor) BETWEEN ? AND ?
    GROUP BY o.nome
    ORDER BY total DESC
  `
    )
    .all(empresaId, de, ate)

  const tempoMedio = db
    .prepare(
      `
    SELECT AVG(
      (julianday(chegada_em) - julianday(saida_em)) * 24
    ) as horas
    FROM entregas
    WHERE empresa_id = ? AND status = 'entregue'
      AND saida_em IS NOT NULL AND chegada_em IS NOT NULL
      AND date(recebido_em_servidor) BETWEEN ? AND ?
  `
    )
    .get(empresaId, de, ate)

  const estoque = db
    .prepare(
      `
    SELECT l.codigo, p.nome as produto,
      l.quantidade_produzida,
      l.quantidade_expedida,
      (l.quantidade_produzida - l.quantidade_expedida) as saldo
    FROM lotes l
    JOIN produtos p ON p.id = l.produto_id
    WHERE l.empresa_id = ? AND l.ativo = 1
    ORDER BY saldo DESC
  `
    )
    .all(empresaId)

  res.json({
    periodo: { de, ate },
    producao: {
      ...producao,
      pecas_boas: boas,
      meta_periodo: metaPeriodo,
      percentual_meta: pctMeta,
      percentual_perdas: pctPerdas,
      argila_por_peca: argilaPorPeca,
      pendentes_validacao: pendentesValidacao.total
    },
    por_motivo: porMotivo,
    por_produto: porProduto,
    por_turno: porTurno,
    evolucao,
    entregas: {
      ...entregas,
      tempo_medio_horas: tempoMedio.horas ? Math.round(tempoMedio.horas * 10) / 10 : 0,
      por_obra: entregasPorObra
    },
    estoque_simples: estoque
  })
})

router.get('/auditoria', requirePerm('auditoria.ver'), (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT a.*, u.nome as usuario_nome
    FROM auditoria a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.empresa_id = ?
    ORDER BY a.criado_em DESC
    LIMIT 300
  `
    )
    .all(req.user.empresaId)
  res.json(rows)
})

router.get('/exportar', requirePerm('dashboard.ver'), (req, res) => {
  const de = req.query.de || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const ate = req.query.ate || new Date().toISOString().slice(0, 10)

  const rows = db
    .prepare(
      `
    SELECT p.data_producao, t.nome as turno, pr.nome as produto,
      i.quantidade_produzida, i.quantidade_refugo, m.nome as motivo, i.consumo_argila,
      p.status, u.nome as operador
    FROM itens_producao i
    JOIN producoes p ON p.id = i.producao_id
    JOIN turnos t ON t.id = p.turno_id
    JOIN produtos pr ON pr.id = i.produto_id
    JOIN usuarios u ON u.id = p.criado_por
    LEFT JOIN motivos_refugo m ON m.id = i.motivo_refugo_id
    WHERE p.empresa_id = ? AND p.data_producao BETWEEN ? AND ?
    ORDER BY p.data_producao, t.nome
  `
    )
    .all(req.user.empresaId, de, ate)

  audit({
    empresaId: req.user.empresaId,
    entidade: 'relatorio',
    entidadeId: `${de}_${ate}`,
    acao: 'exportar',
    usuarioId: req.user.id,
    ip: req.ip
  })

  const header = 'data;turno;produto;produzido;refugo;motivo;argila;status;operador\n'
  const csv =
    header +
    rows
      .map((r) =>
        [
          r.data_producao,
          r.turno,
          r.produto,
          r.quantidade_produzida,
          r.quantidade_refugo,
          r.motivo || '',
          r.consumo_argila || '',
          r.status,
          r.operador
        ].join(';')
      )
      .join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="producao_${de}_${ate}.csv"`)
  res.send('\uFEFF' + csv)
})

export default router
