import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbiente } from './helpers.js'

let ctx

const SENHA = 'senha-forte-123'

function conta(sobrescrever = {}) {
  return {
    nome: 'Ana Ribeiro',
    empresa: 'Cerâmica Ribeiro',
    cnpj: '12.345.678/0001-90',
    login: 'ana.ribeiro',
    senha: SENHA,
    cargo: 'admin',
    ...sobrescrever
  }
}

function registrar(dados) {
  return ctx.request(ctx.app).post('/api/auth/registrar').send(conta(dados))
}

beforeAll(async () => {
  ctx = await criarAmbiente()
})

afterAll(async () => {
  await ctx.limpar()
})

describe('cadastro de conta', () => {
  it('cria empresa, usuário e catálogo inicial e já devolve sessão', async () => {
    const res = await registrar()

    expect(res.status).toBe(201)
    expect(res.body.usuario).toMatchObject({
      nome: 'Ana Ribeiro',
      login: 'ana.ribeiro',
      perfil: 'admin',
      empresaNome: 'Cerâmica Ribeiro'
    })
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
    expect(res.body.dispositivoId).toBeTruthy()

    const referencia = await ctx
      .request(ctx.app)
      .get('/api/catalogo/referencia')
      .set('Authorization', `Bearer ${res.body.accessToken}`)

    expect(referencia.status).toBe(200)
    expect(referencia.body.produtos).toHaveLength(1)
    expect(referencia.body.turnos).toHaveLength(3)
    expect(referencia.body.motivos_refugo).toHaveLength(5)
    expect(referencia.body.lotes).toHaveLength(1)
    expect(referencia.body.clientes).toHaveLength(1)
    expect(referencia.body.obras).toHaveLength(1)
    expect(referencia.body.veiculos).toHaveLength(1)
    expect(referencia.body.metas_producao).toHaveLength(1)

    const empresa = ctx.db
      .prepare('SELECT * FROM empresas WHERE id = ?')
      .get(res.body.usuario.empresaId)
    expect(empresa).toMatchObject({ nome: 'Cerâmica Ribeiro', cnpj: '12345678000190' })
  })

  it('permite entrar apenas com login e senha, sem informar cargo', async () => {
    await registrar({ login: 'bruno', cargo: 'gestor', nome: 'Bruno Lima', empresa: 'Olaria Lima' })

    const res = await ctx
      .request(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'bruno', senha: SENHA })

    expect(res.status).toBe(200)
    expect(res.body.usuario).toMatchObject({
      login: 'bruno',
      perfil: 'gestor',
      empresaNome: 'Olaria Lima'
    })
  })

  it('rejeita login já utilizado por outra empresa', async () => {
    const res = await registrar({ login: 'admin', empresa: 'Outra Cerâmica' })

    expect(res.status).toBe(409)
    expect(res.body.erro).toMatch(/já está em uso/)
  })

  it('isola os dados da nova conta da empresa de demonstração', async () => {
    const res = await registrar({ login: 'carla', nome: 'Carla Souza', empresa: 'Cerâmica Souza' })

    const usuarios = await ctx
      .request(ctx.app)
      .get('/api/catalogo/usuarios')
      .set('Authorization', `Bearer ${res.body.accessToken}`)

    expect(usuarios.status).toBe(200)
    expect(usuarios.body).toHaveLength(1)
    expect(usuarios.body[0].login).toBe('carla')
  })

  it('aplica as permissões do cargo escolhido', async () => {
    const res = await registrar({ login: 'diego', nome: 'Diego Alves', cargo: 'operador' })

    const usuarios = await ctx
      .request(ctx.app)
      .get('/api/catalogo/usuarios')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
    expect(usuarios.status).toBe(403)

    const producoes = await ctx
      .request(ctx.app)
      .get('/api/producoes')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
    expect(producoes.status).toBe(200)
  })

  it('valida senha, cargo e formato do usuário', async () => {
    const senhaFraca = await registrar({ login: 'senha-fraca', senha: '123456' })
    expect(senhaFraca.status).toBe(400)
    expect(senhaFraca.body.detalhes.senha[0]).toMatch(/8 caracteres/)

    const cargoInvalido = await registrar({ login: 'cargo-invalido', cargo: 'diretor' })
    expect(cargoInvalido.status).toBe(400)
    expect(cargoInvalido.body.detalhes.cargo[0]).toMatch(/cargo válido/)

    const loginInvalido = await registrar({ login: 'nome com espaço' })
    expect(loginInvalido.status).toBe(400)
  })

  it('registra o cadastro na auditoria sem armazenar a senha', async () => {
    const res = await registrar({ login: 'elisa', nome: 'Elisa Prado', empresa: 'Cerâmica Prado' })

    const evento = ctx.db
      .prepare("SELECT * FROM auditoria WHERE acao = 'registro' AND entidade_id = ?")
      .get(res.body.usuario.id)

    expect(evento).toBeTruthy()
    expect(evento.valor_novo).toContain('Cerâmica Prado')
    expect(evento.valor_novo).not.toContain(SENHA)

    const usuario = ctx.db
      .prepare('SELECT senha_hash FROM usuarios WHERE id = ?')
      .get(res.body.usuario.id)
    expect(usuario.senha_hash).not.toBe(SENHA)
  })
})
