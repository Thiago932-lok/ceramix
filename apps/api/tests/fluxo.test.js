import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbiente, entrar, payloadEntrega, payloadProducao } from './helpers.js'

let ctx

async function saldoLote(loteId) {
  const row = ctx.db
    .prepare('SELECT quantidade_produzida, quantidade_expedida FROM lotes WHERE id = ?')
    .get(loteId)
  return row.quantidade_produzida - row.quantidade_expedida
}

beforeAll(async () => {
  ctx = await criarAmbiente()
})

afterAll(async () => {
  await ctx.limpar()
})

describe('sincronização idempotente', () => {
  it('aceita lote e não duplica efeitos em reenvio', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const payload = payloadProducao(ctx.ids, { quantidade: 100, refugo: 10 })

    const primeiro = await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itens: [{ id: payload.id, tipo: 'producao', dados: payload }] })

    expect(primeiro.status).toBe(200)
    expect(primeiro.body.resultados[0].status).toBe('ACEITO')
    expect(await saldoLote(ctx.ids.loteId)).toBe(1090)

    const reenvio = await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itens: [{ id: payload.id, tipo: 'producao', dados: payload }] })

    expect(reenvio.body.resultados[0].status).toBe('JA_RECEBIDO')
    expect(await saldoLote(ctx.ids.loteId)).toBe(1090)
  })

  it('rejeita refugo maior que a produção', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const payload = payloadProducao(ctx.ids, { quantidade: 10, refugo: 20 })

    const res = await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itens: [{ id: payload.id, tipo: 'producao', dados: payload }] })

    expect(res.body.resultados[0].status).toBe('REJEITADO')
    expect(res.body.resultados[0].erro).toMatch(/refugo/i)
  })

  it('rejeita tipo desconhecido sem interromper o lote', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const res = await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itens: [{ id: 'x', tipo: 'inexistente', dados: {} }] })

    expect(res.status).toBe(200)
    expect(res.body.resultados[0].status).toBe('REJEITADO')
  })
})

describe('ciclo de produção', () => {
  it('valida e cancela produção revertendo o lote', async () => {
    const producao = payloadProducao(ctx.ids, { quantidade: 50, refugo: 0 })
    const operador = await entrar(ctx.request, ctx.app, 'operador')

    const criada = await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${operador.accessToken}`)
      .send({ itens: [{ id: producao.id, tipo: 'producao', dados: producao }] })
    expect(criada.body.resultados[0].status).toBe('ACEITO')

    const antes = await saldoLote(ctx.ids.loteId)

    const gestor = await entrar(ctx.request, ctx.app, 'gestor')
    const validada = await ctx
      .request(ctx.app)
      .post(`/api/producoes/${producao.id}/validar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({})
    expect(validada.status).toBe(200)

    const cancelada = await ctx
      .request(ctx.app)
      .post(`/api/producoes/${producao.id}/cancelar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({ motivo: 'Apontamento duplicado' })
    expect(cancelada.status).toBe(200)
    expect(await saldoLote(ctx.ids.loteId)).toBe(antes - 50)
  })

  it('exige motivo no cancelamento', async () => {
    const gestor = await entrar(ctx.request, ctx.app, 'gestor')
    const res = await ctx
      .request(ctx.app)
      .post(`/api/producoes/${crypto.randomUUID()}/cancelar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({ motivo: '' })

    expect(res.status).toBe(400)
  })
})

describe('ciclo de entrega', () => {
  it('registra saída, valida saldo e confirma chegada', async () => {
    const gestor = await entrar(ctx.request, ctx.app, 'gestor')
    const saldoInicial = await saldoLote(ctx.ids.loteId)

    const acimaDoSaldo = await ctx
      .request(ctx.app)
      .post('/api/entregas')
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send(payloadEntrega(ctx.ids, { quantidade: saldoInicial + 1 }))
    expect(acimaDoSaldo.status).toBe(400)

    const entrega = payloadEntrega(ctx.ids, { quantidade: 300 })
    const criada = await ctx
      .request(ctx.app)
      .post('/api/entregas')
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send(entrega)
    expect(criada.status).toBe(201)
    expect(await saldoLote(ctx.ids.loteId)).toBe(saldoInicial - 300)

    const confirmada = await ctx
      .request(ctx.app)
      .post(`/api/entregas/${entrega.id}/confirmar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({ lat: -23.5, lng: -46.6 })
    expect(confirmada.status).toBe(200)

    const timeline = await ctx
      .request(ctx.app)
      .get(`/api/entregas/${entrega.id}/timeline`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
    expect(timeline.status).toBe(200)
    expect(timeline.body.eventos.some((e) => e.tipo === 'gps_chegada')).toBe(true)

    const cancelada = await ctx
      .request(ctx.app)
      .post(`/api/entregas/${entrega.id}/cancelar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({ motivo: 'Carga devolvida' })
    expect(cancelada.status).toBe(200)
    expect(await saldoLote(ctx.ids.loteId)).toBe(saldoInicial)
  })

  it('bloqueia cancelamento de produção cujo lote já foi expedido', async () => {
    const operador = await entrar(ctx.request, ctx.app, 'operador')
    const gestor = await entrar(ctx.request, ctx.app, 'gestor')

    const producao = payloadProducao(ctx.ids, { quantidade: 100, refugo: 0 })
    await ctx
      .request(ctx.app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${operador.accessToken}`)
      .send({ itens: [{ id: producao.id, tipo: 'producao', dados: producao }] })

    const saldo = await saldoLote(ctx.ids.loteId)
    await ctx
      .request(ctx.app)
      .post('/api/entregas')
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send(payloadEntrega(ctx.ids, { quantidade: saldo - 50 }))

    const res = await ctx
      .request(ctx.app)
      .post(`/api/producoes/${producao.id}/cancelar`)
      .set('Authorization', `Bearer ${gestor.accessToken}`)
      .send({ motivo: 'Erro de apontamento' })

    expect(res.status).toBe(409)
  })
})
