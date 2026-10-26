import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbiente, entrar } from './helpers.js'

let ctx

beforeAll(async () => {
  ctx = await criarAmbiente()
})

afterAll(async () => {
  await ctx.limpar()
})

describe('infraestrutura', () => {
  it('expõe health check com status do banco', async () => {
    const res = await ctx.request(ctx.app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, servico: 'ceramix-api', banco: 'ok' })
    expect(res.body.requisicao_id ?? res.headers['x-request-id']).toBeTruthy()
  })

  it('retorna 404 estruturado para rota inexistente', async () => {
    const res = await ctx.request(ctx.app).get('/api/nao-existe')
    expect(res.status).toBe(404)
    expect(res.body.erro).toBe('Rota não encontrada')
  })

  it('rejeita JSON malformado', async () => {
    const res = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"login": "admin", ')
    expect(res.status).toBe(400)
    expect(res.body.erro).toMatch(/JSON inválido/)
  })
})

describe('autenticação', () => {
  it('autentica com credenciais válidas e retorna perfil', async () => {
    const res = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'admin', senha: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.usuario).toMatchObject({ login: 'admin', perfil: 'admin' })
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.dispositivoId).toBeTruthy()
  })

  it('rejeita credenciais inválidas sem revelar se o usuário existe', async () => {
    const senhaErrada = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'admin', senha: 'senha-errada' })
    const usuarioInexistente = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'fantasma', senha: 'senha-errada' })

    expect(senhaErrada.status).toBe(401)
    expect(usuarioInexistente.status).toBe(401)
    expect(senhaErrada.body.erro).toBe(usuarioInexistente.body.erro)
  })

  it('bloqueia temporariamente após cinco falhas', async () => {
    for (let i = 0; i < 5; i += 1) {
      await ctx
        .request(ctx.app)
        .post('/api/auth/login')
        .send({ login: 'conferente', senha: 'errada' })
    }
    const res = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'conferente', senha: '123456' })

    expect(res.status).toBe(423)
  })

  it('protege rotas autenticadas', async () => {
    const res = await ctx.request(ctx.app).get('/api/producoes')
    expect(res.status).toBe(401)
  })

  it('rotaciona refresh token e invalida o anterior', async () => {
    const login = await entrar(ctx.request, ctx.app, 'gestor')
    const refreshOriginal = login.refreshToken

    const renovado = await ctx
      .request(ctx.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshOriginal })
    expect(renovado.status).toBe(200)
    expect(renovado.body.accessToken).toBeTruthy()
    expect(renovado.body.refreshToken).not.toBe(refreshOriginal)

    const reutilizado = await ctx
      .request(ctx.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshOriginal })
    expect(reutilizado.status).toBe(401)
  })

  it('revoga refresh token no logout', async () => {
    const login = await entrar(ctx.request, ctx.app, 'operador')

    const me = await ctx
      .request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.usuario.login).toBe('operador')

    const logout = await ctx
      .request(ctx.app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ refreshToken: login.refreshToken })
    expect(logout.status).toBe(200)

    const refresh = await ctx
      .request(ctx.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.refreshToken })
    expect(refresh.status).toBe(401)
  })
})
