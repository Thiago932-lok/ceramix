import Dexie from 'dexie'

export const db = new Dexie('ceramix')

db.version(1).stores({
  sessao: 'id',
  referencia: 'chave',
  outbox: 'id, status, criado_em, tipo',
  meta: 'chave'
})

export const CATALOGO_VAZIO = {
  produtos: [],
  turnos: [],
  motivos_refugo: [],
  lotes: [],
  obras: [],
  veiculos: [],
  metas_producao: [],
  clientes: []
}

export async function pedirPersistencia() {
  if (navigator.storage?.persist) {
    try {
      await navigator.storage.persist()
    } catch {
      // navegador pode negar persistência; o app continua funcionando
    }
  }
}

export async function getDispositivoId() {
  const row = await db.meta.get('dispositivo_id')
  if (row?.valor) return row.valor
  const id = crypto.randomUUID()
  await db.meta.put({ chave: 'dispositivo_id', valor: id })
  return id
}

export async function obterMeta(chave) {
  const row = await db.meta.get(chave)
  return row?.valor ?? null
}

export async function salvarMeta(chave, valor) {
  await db.meta.put({ chave, valor })
}

export async function salvarReferencia(dados) {
  await db.referencia.put({
    chave: 'catalogo',
    valor: dados,
    atualizado_em: new Date().toISOString()
  })
}

export async function obterReferencia() {
  const row = await db.referencia.get('catalogo')
  return row?.valor || null
}

export async function enfileirar(registro) {
  await db.outbox.put({
    ...registro,
    status: 'PENDENTE',
    tentativas: 0,
    erro: null,
    criado_em: registro.criado_em || new Date().toISOString()
  })
}

export async function listarPendentes() {
  return db.outbox.where('status').anyOf(['PENDENTE', 'REJEITADO']).sortBy('criado_em')
}

export async function contarPendentes() {
  return db.outbox.where('status').equals('PENDENTE').count()
}

export async function atualizarOutbox(id, patch) {
  await db.outbox.update(id, patch)
}

export async function removerOutbox(id) {
  await db.outbox.delete(id)
}

export async function limparSessaoLocal() {
  await db.sessao.clear()
}
