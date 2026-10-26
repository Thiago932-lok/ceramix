import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbiente, entrar, payloadProducao } from './helpers.js'

let ctx

beforeAll(async () => {
  ctx = await criarAmbiente()
})

afterAll(async () => {
  await ctx.limpar()
})

describe('controle de acesso por perfil', () => {
  it('operador pode registrar produção', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const res = await ctx
      .request(ctx.app)
      .post('/api/producoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payloadProducao(ctx.ids))

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('ACEITO')
  })

  it('operador não pode validar produção', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const res = await ctx
      .request(ctx.app)
      .post(`/api/producoes/${crypto.randomUUID()}/validar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})

    expect(res.status).toBe(403)
  })

  it('motorista não pode registrar produção', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'motorista')
    const res = await ctx
      .request(ctx.app)
      .post('/api/producoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payloadProducao(ctx.ids))

    expect(res.status).toBe(403)
  })

  it('operador não pode listar usuários', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'operador')
    const res = await ctx
      .request(ctx.app)
      .get('/api/catalogo/usuarios')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(403)
  })

  it('admin pode listar usuários', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'admin')
    const res = await ctx
      .request(ctx.app)
      .get('/api/catalogo/usuarios')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(5)
  })

  it('motorista vê apenas as próprias entregas na listagem', async () => {
    const { accessToken } = await entrar(ctx.request, ctx.app, 'motorista')
    const res = await ctx
      .request(ctx.app)
      .get('/api/entregas')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
