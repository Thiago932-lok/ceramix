import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import db from './connection.js'

dotenv.config()

const now = () => new Date().toISOString()
const empresaId = uuid()
const ts = now()

const existing = db.prepare('SELECT id FROM empresas LIMIT 1').get()
if (existing) {
  console.log('Banco ja possui dados. Seed ignorado.')
  process.exit(0)
}

const insertEmpresa = db.prepare(`
  INSERT INTO empresas (id, nome, cnpj, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, 1, ?, ?)
`)

const insertUsuario = db.prepare(`
  INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
`)

const insertProduto = db.prepare(`
  INSERT INTO produtos (id, empresa_id, nome, codigo, unidade, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, 'un', 1, ?, ?)
`)

const insertTurno = db.prepare(`
  INSERT INTO turnos (id, empresa_id, nome, hora_inicio, hora_fim, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
`)

const insertMotivo = db.prepare(`
  INSERT INTO motivos_refugo (id, empresa_id, nome, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, 1, ?, ?)
`)

const insertCliente = db.prepare(`
  INSERT INTO clientes (id, empresa_id, nome, documento, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, 1, ?, ?)
`)

const insertObra = db.prepare(`
  INSERT INTO obras (id, empresa_id, cliente_id, nome, endereco, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
`)

const insertVeiculo = db.prepare(`
  INSERT INTO veiculos (id, empresa_id, placa, descricao, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, 1, ?, ?)
`)

const insertMeta = db.prepare(`
  INSERT INTO metas_producao (id, empresa_id, produto_id, turno_id, meta_diaria, vigencia_inicio, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
`)

const insertLote = db.prepare(`
  INSERT INTO lotes (id, empresa_id, codigo, produto_id, quantidade_produzida, quantidade_expedida, qr_code, ativo, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
`)

const seed = db.transaction(() => {
  insertEmpresa.run(empresaId, 'Cerâmica Integra Ltda', '12.345.678/0001-90', ts, ts)

  const senha = bcrypt.hashSync('123456', 10)
  const users = [
    { id: uuid(), nome: 'Administrador', login: 'admin', perfil: 'admin' },
    { id: uuid(), nome: 'Maria Gestora', login: 'gestor', perfil: 'gestor' },
    { id: uuid(), nome: 'Carlos Supervisor', login: 'supervisor', perfil: 'supervisor' },
    { id: uuid(), nome: 'João Operador', login: 'operador', perfil: 'operador' },
    { id: uuid(), nome: 'Pedro Conferente', login: 'conferente', perfil: 'conferente' },
    { id: uuid(), nome: 'Lucas Motorista', login: 'motorista', perfil: 'motorista' }
  ]
  for (const u of users) {
    insertUsuario.run(u.id, empresaId, u.nome, u.login, senha, u.perfil, ts, ts)
  }

  const produtos = [
    { id: uuid(), nome: 'Tijolo 6 furos', codigo: 'TIJ-6F' },
    { id: uuid(), nome: 'Tijolo 8 furos', codigo: 'TIJ-8F' },
    { id: uuid(), nome: 'Bloco estrutural', codigo: 'BLC-EST' },
    { id: uuid(), nome: 'Telha colonial', codigo: 'TEL-COL' }
  ]
  for (const p of produtos) {
    insertProduto.run(p.id, empresaId, p.nome, p.codigo, ts, ts)
  }

  const turnos = [
    { id: uuid(), nome: 'Manhã', inicio: '06:00', fim: '14:00' },
    { id: uuid(), nome: 'Tarde', inicio: '14:00', fim: '22:00' },
    { id: uuid(), nome: 'Noite', inicio: '22:00', fim: '06:00' }
  ]
  for (const t of turnos) {
    insertTurno.run(t.id, empresaId, t.nome, t.inicio, t.fim, ts, ts)
  }

  const motivos = [
    'Trinca',
    'Quebra no forno',
    'Deformação',
    'Queima irregular',
    'Dimensão fora do padrão'
  ].map((nome) => ({ id: uuid(), nome }))
  for (const motivo of motivos) {
    insertMotivo.run(motivo.id, empresaId, motivo.nome, ts, ts)
  }

  const clienteId = uuid()
  insertCliente.run(clienteId, empresaId, 'Construtora Horizonte', '98.765.432/0001-10', ts, ts)

  const obras = [
    { id: uuid(), nome: 'Residencial Parque Sul', endereco: 'Av. das Acácias, 1200' },
    { id: uuid(), nome: 'Obra Centro Comercial', endereco: 'Rua Industrial, 450' },
    { id: uuid(), nome: 'Condomínio Vale Verde', endereco: 'Estrada Municipal KM 8' }
  ]
  for (const o of obras) {
    insertObra.run(o.id, empresaId, clienteId, o.nome, o.endereco, ts, ts)
  }

  const veiculos = [
    { id: uuid(), placa: 'ABC1D23', descricao: 'Caminhão truck 1' },
    { id: uuid(), placa: 'EFG4H56', descricao: 'Caminhão truck 2' },
    { id: uuid(), placa: 'IJK7L89', descricao: 'Carreta 1' }
  ]
  for (const v of veiculos) {
    insertVeiculo.run(v.id, empresaId, v.placa, v.descricao, ts, ts)
  }

  for (const p of produtos) {
    insertMeta.run(uuid(), empresaId, p.id, turnos[0].id, 1200, ts.slice(0, 10), ts, ts)
  }

  const loteIds = []
  for (let i = 0; i < produtos.length; i++) {
    const codigo = `L${String(i + 1).padStart(4, '0')}-${new Date().getFullYear()}`
    const qtd = 2000 + i * 500
    const loteId = uuid()
    loteIds.push(loteId)
    insertLote.run(loteId, empresaId, codigo, produtos[i].id, qtd, codigo, ts, ts)
  }

  const operador = users.find((u) => u.perfil === 'operador')
  const supervisor = users.find((u) => u.perfil === 'supervisor')
  const conferente = users.find((u) => u.perfil === 'conferente')
  const motorista = users.find((u) => u.perfil === 'motorista')

  const insertProducao = db.prepare(`
    INSERT INTO producoes (
      id, empresa_id, turno_id, data_producao, status, observacao,
      criado_por, criado_em_cliente, recebido_em_servidor, validado_por, validado_em, versao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `)
  const insertItemProducao = db.prepare(`
    INSERT INTO itens_producao (
      id, producao_id, empresa_id, produto_id, lote_id,
      quantidade_produzida, quantidade_refugo, motivo_refugo_id, consumo_argila, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const somarProducaoLote = db.prepare(`
    UPDATE lotes SET quantidade_produzida = quantidade_produzida + ?, atualizado_em = ?
    WHERE id = ?
  `)

  const pad = (valor) => String(valor).padStart(2, '0')
  const dataLocal = (data) =>
    `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`
  const horaEm = (base, hora) => {
    const data = new Date(base)
    data.setHours(hora, 0, 0, 0)
    return data.toISOString()
  }
  const turnoDoHorario = (data) => {
    const hora = data.getHours()
    if (hora >= 6 && hora < 14) return 0
    if (hora >= 14 && hora < 22) return 1
    return 2
  }

  const agora = Date.now()
  const producoesCriadas = []

  const registrarProducao = ({
    base,
    turnoIndex,
    produtoIndex,
    produzida,
    refugo,
    recebido,
    pendente
  }) => {
    const produto = produtos[produtoIndex]
    const turno = turnos[turnoIndex]
    const loteId = loteIds[produtoIndex]
    const producaoId = uuid()
    const recebidoEm = new Date(recebido)
    const motivo = motivos[(recebidoEm.getDate() + produtoIndex + turnoIndex) % motivos.length]
    // A validação sempre ocorre depois do lançamento, mas nunca no futuro.
    const validadoEm = new Date(Math.min(recebidoEm.getTime() + 2 * 3_600_000, agora - 5 * 60_000))

    insertProducao.run(
      producaoId,
      empresaId,
      turno.id,
      dataLocal(base),
      pendente ? 'pendente_validacao' : 'validado',
      pendente ? 'Aguardando conferência do supervisor do turno.' : null,
      operador.id,
      recebido,
      recebido,
      pendente ? null : supervisor.id,
      pendente ? null : validadoEm.toISOString()
    )
    insertItemProducao.run(
      uuid(),
      producaoId,
      empresaId,
      produto.id,
      loteId,
      produzida,
      refugo,
      refugo > 0 ? motivo.id : null,
      Math.round(produzida * 0.0026 * 10) / 10,
      recebido
    )
    somarProducaoLote.run(produzida - refugo, recebido, loteId)
    producoesCriadas.push({
      id: producaoId,
      status: pendente ? 'pendente_validacao' : 'validado',
      recebido,
      validadoEm: pendente ? null : validadoEm.toISOString()
    })
  }

  for (let dia = 6; dia >= 1; dia -= 1) {
    const base = new Date(Date.now() - dia * 86_400_000)
    for (let n = 0; n < 3; n += 1) {
      const recebido = horaEm(base, [10, 17, 23][n])
      registrarProducao({
        base,
        turnoIndex: n,
        produtoIndex: (dia + n) % produtos.length,
        produzida: 1400 + ((dia * 3 + n * 7) % 5) * 90,
        refugo: 18 + ((dia + n) % 4) * 11,
        recebido,
        pendente: false
      })
    }
  }

  const hoje = new Date()
  const producoesDeHoje = [
    { horas: 3, produtoIndex: 0, pendente: false, refugo: 26 },
    { horas: 1, produtoIndex: 1, pendente: false, refugo: 34 },
    { horas: 0.15, produtoIndex: 2, pendente: true, refugo: 19 }
  ]
  for (const item of producoesDeHoje) {
    const recebido = new Date(agora - item.horas * 3_600_000)
    registrarProducao({
      base: hoje,
      turnoIndex: turnoDoHorario(recebido),
      produtoIndex: item.produtoIndex,
      produzida: 1500 + item.produtoIndex * 60,
      refugo: item.refugo,
      recebido: recebido.toISOString(),
      pendente: item.pendente
    })
  }

  const insertEntrega = db.prepare(`
    INSERT INTO entregas (
      id, empresa_id, obra_id, veiculo_id, motorista_id, status,
      saida_em, saida_lat, saida_lng, chegada_em, chegada_lat, chegada_lng,
      confirmado_por, confirmado_em, observacao,
      criado_por, criado_em_cliente, recebido_em_servidor, versao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `)
  const insertItemEntrega = db.prepare(`
    INSERT INTO itens_entrega (id, entrega_id, empresa_id, lote_id, produto_id, quantidade, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertEvento = db.prepare(`
    INSERT INTO eventos_rastreio (id, empresa_id, entrega_id, lote_id, tipo, usuario_id, lat, lng, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const somarExpedicaoLote = db.prepare(`
    UPDATE lotes SET quantidade_expedida = quantidade_expedida + ?, atualizado_em = ?
    WHERE id = ?
  `)

  const entregas = [
    {
      obra: obras[1],
      veiculo: veiculos[1],
      loteIdx: 2,
      quantidade: 800,
      observacao: 'Blocos estruturais para a fundação do bloco B.',
      saida: new Date(agora - 8 * 3_600_000),
      chegada: new Date(agora - 5 * 3_600_000),
      gpsSaida: { lat: -22.9056, lng: -47.0608 },
      gpsChegada: { lat: -22.9121, lng: -47.0655 }
    },
    {
      obra: obras[0],
      veiculo: veiculos[0],
      loteIdx: 3,
      quantidade: 500,
      observacao: 'Primeira carga de telha para a etapa de cobertura.',
      saida: new Date(agora - 2 * 3_600_000),
      chegada: null,
      gpsSaida: { lat: -22.9056, lng: -47.0608 },
      gpsChegada: null
    }
  ]

  const entregasCriadas = []
  for (const entrega of entregas) {
    const entregaId = uuid()
    const loteId = loteIds[entrega.loteIdx]
    const produtoId = produtos[entrega.loteIdx].id
    const saidaEm = entrega.saida.toISOString()

    insertEntrega.run(
      entregaId,
      empresaId,
      entrega.obra.id,
      entrega.veiculo.id ?? uuid(),
      motorista.id,
      entrega.chegada ? 'entregue' : 'saida_registrada',
      saidaEm,
      entrega.gpsSaida?.lat ?? null,
      entrega.gpsSaida?.lng ?? null,
      entrega.chegada ? entrega.chegada.toISOString() : null,
      entrega.gpsChegada?.lat ?? null,
      entrega.gpsChegada?.lng ?? null,
      entrega.chegada ? conferente.id : null,
      entrega.chegada ? entrega.chegada.toISOString() : null,
      entrega.observacao,
      conferente.id,
      saidaEm,
      saidaEm
    )
    insertItemEntrega.run(
      uuid(),
      entregaId,
      empresaId,
      loteId,
      produtoId,
      entrega.quantidade,
      saidaEm
    )
    somarExpedicaoLote.run(entrega.quantidade, saidaEm, loteId)

    insertEvento.run(
      uuid(),
      empresaId,
      entregaId,
      loteId,
      'qr_saida',
      conferente.id,
      entrega.gpsSaida?.lat ?? null,
      entrega.gpsSaida?.lng ?? null,
      saidaEm
    )
    if (entrega.gpsSaida) {
      insertEvento.run(
        uuid(),
        empresaId,
        entregaId,
        null,
        'gps_saida',
        conferente.id,
        entrega.gpsSaida.lat,
        entrega.gpsSaida.lng,
        saidaEm
      )
    }
    if (entrega.chegada) {
      insertEvento.run(
        uuid(),
        empresaId,
        entregaId,
        null,
        'confirmacao',
        conferente.id,
        entrega.gpsChegada?.lat ?? null,
        entrega.gpsChegada?.lng ?? null,
        entrega.chegada.toISOString()
      )
      if (entrega.gpsChegada) {
        insertEvento.run(
          uuid(),
          empresaId,
          entregaId,
          null,
          'gps_chegada',
          conferente.id,
          entrega.gpsChegada.lat,
          entrega.gpsChegada.lng,
          entrega.chegada.toISOString()
        )
      }
    }
    entregasCriadas.push({
      id: entregaId,
      status: entrega.chegada ? 'entregue' : 'saida_registrada'
    })
  }

  const insertAuditoria = db.prepare(`
    INSERT INTO auditoria (
      id, empresa_id, entidade, entidade_id, acao, usuario_id,
      valor_antigo, valor_novo, ip, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1', ?)
  `)
  const ultimaValidada = [...producoesCriadas].reverse().find((item) => item.status === 'validado')
  const pendente = [...producoesCriadas]
    .reverse()
    .find((item) => item.status === 'pendente_validacao')
  const entregaEntregue = entregasCriadas.find((item) => item.status === 'entregue')

  if (pendente) {
    insertAuditoria.run(
      uuid(),
      empresaId,
      'producao',
      pendente.id,
      'criar',
      operador.id,
      null,
      JSON.stringify({ status: 'pendente_validacao' }),
      pendente.recebido
    )
  }
  if (ultimaValidada) {
    insertAuditoria.run(
      uuid(),
      empresaId,
      'producao',
      ultimaValidada.id,
      'validar',
      supervisor.id,
      JSON.stringify({ status: 'pendente_validacao' }),
      JSON.stringify({ status: 'validado' }),
      ultimaValidada.validadoEm
    )
  }
  if (entregaEntregue) {
    insertAuditoria.run(
      uuid(),
      empresaId,
      'entrega',
      entregaEntregue.id,
      'confirmar',
      conferente.id,
      JSON.stringify({ status: 'saida_registrada' }),
      JSON.stringify({ status: 'entregue' }),
      new Date(agora - 5 * 3_600_000).toISOString()
    )
  }
})

seed()
console.log('Seed concluido.')
console.log('Logins: admin / gestor / supervisor / operador / conferente / motorista')
console.log('Senha: 123456')
