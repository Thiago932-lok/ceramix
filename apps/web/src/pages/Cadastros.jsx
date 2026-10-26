import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialogs } from '../context/DialogContext'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'
import { dataHora, numero, rotuloPerfil } from '../lib/format'
import { Badge, Callout, Card, EmptyState, Field, PageHeader, Spinner } from '../components/Ui'
import Icon from '../components/Icon'

const PERFIS = ['operador', 'conferente', 'motorista', 'supervisor', 'gestor', 'admin']
const UNIDADES = ['un', 'm²', 't', 'kg', 'milheiro']

function gerarSenha() {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const valores = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(valores, (valor) => alfabeto[valor % alfabeto.length]).join('')
}

export default function Cadastros() {
  const { usuario } = useAuth()
  const { confirmar } = useDialogs()
  const { sincronizar } = useSync()
  const { sucesso, erro: avisarErro } = useToast()

  const ehAdmin = usuario.perfil === 'admin'
  const [aba, setAba] = useState('produtos')
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState(null)
  const [usuarios, setUsuarios] = useState(null)
  const [dispositivos, setDispositivos] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [falha, setFalha] = useState('')
  const [salvando, setSalvando] = useState('')

  const [produtoForm, setProdutoForm] = useState({ nome: '', codigo: '', unidade: 'un' })
  const [loteForm, setLoteForm] = useState({ codigo: '', produto_id: '', quantidade_produzida: '' })
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    login: '',
    senha: '',
    perfil: 'operador'
  })
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const abas = useMemo(
    () =>
      [
        { chave: 'produtos', rotulo: 'Produtos', icone: 'package' },
        { chave: 'lotes', rotulo: 'Lotes', icone: 'layers' },
        ehAdmin && { chave: 'usuarios', rotulo: 'Usuários', icone: 'users' },
        ehAdmin && { chave: 'dispositivos', rotulo: 'Dispositivos', icone: 'smartphone' }
      ].filter(Boolean),
    [ehAdmin]
  )

  const carregarProdutos = useCallback(async () => {
    const lista = await api('/catalogo/produtos')
    setProdutos(lista)
    setLoteForm((atual) => ({
      ...atual,
      produto_id: atual.produto_id || lista[0]?.id || ''
    }))
    return lista
  }, [])

  const carregarAba = useCallback(
    async (chave) => {
      setFalha('')
      if (chave === 'produtos') await carregarProdutos()
      if (chave === 'lotes') {
        const [, listaLotes] = await Promise.all([carregarProdutos(), api('/catalogo/lotes')])
        setLotes(listaLotes)
      }
      if (chave === 'usuarios') setUsuarios(await api('/catalogo/usuarios'))
      if (chave === 'dispositivos') setDispositivos(await api('/catalogo/dispositivos'))
    },
    [carregarProdutos]
  )

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    carregarAba(aba)
      .catch((e) => {
        if (ativo) setFalha(e.message)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [aba, carregarAba])

  async function criarProduto(evento) {
    evento.preventDefault()
    setSalvando('produto')
    try {
      await api('/catalogo/produtos', { method: 'POST', body: produtoForm })
      sucesso('Produto cadastrado.')
      setProdutoForm({ nome: '', codigo: '', unidade: 'un' })
      await carregarProdutos()
      sincronizar()
    } catch (e) {
      avisarErro(e.message || 'Não foi possível cadastrar o produto.')
    } finally {
      setSalvando('')
    }
  }

  async function criarLote(evento) {
    evento.preventDefault()
    setSalvando('lote')
    try {
      await api('/catalogo/lotes', {
        method: 'POST',
        body: {
          ...loteForm,
          quantidade_produzida: Number(loteForm.quantidade_produzida) || 0
        }
      })
      sucesso('Lote cadastrado.')
      setLoteForm((atual) => ({ ...atual, codigo: '', quantidade_produzida: '' }))
      setLotes(await api('/catalogo/lotes'))
      sincronizar()
    } catch (e) {
      avisarErro(e.message || 'Não foi possível cadastrar o lote.')
    } finally {
      setSalvando('')
    }
  }

  async function criarUsuario(evento) {
    evento.preventDefault()
    setSalvando('usuario')
    try {
      await api('/catalogo/usuarios', { method: 'POST', body: usuarioForm })
      sucesso('Usuário cadastrado.')
      setUsuarioForm({ nome: '', login: '', senha: '', perfil: 'operador' })
      setUsuarios(await api('/catalogo/usuarios'))
    } catch (e) {
      avisarErro(e.message || 'Não foi possível cadastrar o usuário.')
    } finally {
      setSalvando('')
    }
  }

  async function revogarDispositivo(dispositivo) {
    const ok = await confirmar({
      titulo: 'Revogar dispositivo?',
      mensagem: `O acesso de ${dispositivo.usuario_nome || 'usuário'} neste aparelho será encerrado e os tokens invalidados.`,
      textoConfirmar: 'Revogar acesso',
      perigo: true,
      icone: 'shield-off'
    })
    if (!ok) return

    setSalvando(dispositivo.id)
    try {
      await api(`/catalogo/dispositivos/${dispositivo.id}/revogar`, { method: 'POST', body: {} })
      sucesso('Dispositivo revogado.')
      setDispositivos(await api('/catalogo/dispositivos'))
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setSalvando('')
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Configuração"
        titulo="Cadastros"
        descricao="Produtos, lotes, usuários e dispositivos da unidade."
      />

      <div className="segmented segmented--tabs" role="tablist" aria-label="Seções de cadastro">
        {abas.map((item) => (
          <button
            key={item.chave}
            type="button"
            role="tab"
            aria-selected={aba === item.chave}
            className={`segment ${aba === item.chave ? 'is-active' : ''}`}
            onClick={() => setAba(item.chave)}
          >
            <Icon name={item.icone} size={17} />
            {item.rotulo}
          </button>
        ))}
      </div>

      {falha && (
        <Callout tom="danger" titulo="Não foi possível carregar">
          {falha}
        </Callout>
      )}

      {aba === 'produtos' && (
        <div className="cadastro-grid">
          <Card titulo="Novo produto" icone="package" className="card--pad">
            <form onSubmit={criarProduto}>
              <Field label="Nome" htmlFor="produto-nome">
                <input
                  id="produto-nome"
                  className="input"
                  value={produtoForm.nome}
                  onChange={(evento) =>
                    setProdutoForm({ ...produtoForm, nome: evento.target.value })
                  }
                  placeholder="Ex.: Tijolo baiano 9 furos"
                  required
                  minLength={2}
                />
              </Field>
              <div className="field-grid">
                <Field label="Código" htmlFor="produto-codigo">
                  <input
                    id="produto-codigo"
                    className="input"
                    value={produtoForm.codigo}
                    onChange={(evento) =>
                      setProdutoForm({ ...produtoForm, codigo: evento.target.value })
                    }
                    placeholder="Ex.: TB-09"
                    required
                  />
                </Field>
                <Field label="Unidade" htmlFor="produto-unidade">
                  <select
                    id="produto-unidade"
                    className="select"
                    value={produtoForm.unidade}
                    onChange={(evento) =>
                      setProdutoForm({ ...produtoForm, unidade: evento.target.value })
                    }
                  >
                    {UNIDADES.map((unidade) => (
                      <option key={unidade} value={unidade}>
                        {unidade}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={salvando === 'produto'}
              >
                {salvando === 'produto' ? <Spinner size={17} /> : <Icon name="plus" size={17} />}
                Cadastrar produto
              </button>
            </form>
          </Card>

          <Card titulo="Produtos" descricao={`${produtos.length} cadastrados`} icone="list">
            {carregando ? (
              <div className="loading-inline">
                <Spinner size={20} />
                <span>Carregando produtos…</span>
              </div>
            ) : produtos.length === 0 ? (
              <EmptyState
                icone="package"
                titulo="Nenhum produto"
                texto="Cadastre o primeiro produto da unidade."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Código</th>
                      <th>Unidade</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((produto) => (
                      <tr key={produto.id}>
                        <td className="is-strong">{produto.nome}</td>
                        <td className="is-mono">{produto.codigo}</td>
                        <td>{produto.unidade}</td>
                        <td>
                          <Badge tom={produto.ativo ? 'success' : 'neutral'}>
                            {produto.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {aba === 'lotes' && (
        <div className="cadastro-grid">
          <Card titulo="Novo lote" icone="layers" className="card--pad">
            <form onSubmit={criarLote}>
              <Field label="Código do lote" htmlFor="lote-codigo">
                <input
                  id="lote-codigo"
                  className="input"
                  value={loteForm.codigo}
                  onChange={(evento) => setLoteForm({ ...loteForm, codigo: evento.target.value })}
                  placeholder="Ex.: L-2026-042"
                  required
                />
              </Field>
              <Field label="Produto" htmlFor="lote-produto">
                <select
                  id="lote-produto"
                  className="select"
                  value={loteForm.produto_id}
                  onChange={(evento) =>
                    setLoteForm({ ...loteForm, produto_id: evento.target.value })
                  }
                  required
                >
                  <option value="">Selecione o produto</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome} ({produto.codigo})
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Quantidade inicial"
                htmlFor="lote-quantidade"
                hint="Peças já disponíveis neste lote no momento do cadastro."
              >
                <div className="input-group">
                  <input
                    id="lote-quantidade"
                    className="input"
                    inputMode="numeric"
                    value={loteForm.quantidade_produzida}
                    onChange={(evento) =>
                      setLoteForm({
                        ...loteForm,
                        quantidade_produzida: evento.target.value.replace(/\D/g, '')
                      })
                    }
                    placeholder="0"
                  />
                  <span className="input-affix">peças</span>
                </div>
              </Field>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={salvando === 'lote'}
              >
                {salvando === 'lote' ? <Spinner size={17} /> : <Icon name="plus" size={17} />}
                Cadastrar lote
              </button>
            </form>
          </Card>

          <Card
            titulo="Lotes"
            descricao={lotes ? `${lotes.length} cadastrados` : 'Carregando…'}
            icone="list"
          >
            {!lotes ? (
              <div className="loading-inline">
                <Spinner size={20} />
                <span>Carregando lotes…</span>
              </div>
            ) : lotes.length === 0 ? (
              <EmptyState
                icone="layers"
                titulo="Nenhum lote"
                texto="Cadastre um lote para controlar o estoque."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Produto</th>
                      <th className="is-num">Produzido</th>
                      <th className="is-num">Expedido</th>
                      <th className="is-num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((lote) => (
                      <tr key={lote.id}>
                        <td className="is-mono is-strong">{lote.codigo}</td>
                        <td>{lote.produto_nome}</td>
                        <td className="is-num">{numero(lote.quantidade_produzida)}</td>
                        <td className="is-num">{numero(lote.quantidade_expedida)}</td>
                        <td className={`is-num ${lote.saldo <= 0 ? 'is-muted' : 'is-strong'}`}>
                          {numero(lote.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {aba === 'usuarios' && ehAdmin && (
        <div className="cadastro-grid">
          <Card titulo="Novo usuário" icone="user" className="card--pad">
            <form onSubmit={criarUsuario}>
              <Field label="Nome completo" htmlFor="usuario-nome">
                <input
                  id="usuario-nome"
                  className="input"
                  value={usuarioForm.nome}
                  onChange={(evento) =>
                    setUsuarioForm({ ...usuarioForm, nome: evento.target.value })
                  }
                  placeholder="Ex.: Maria Aparecida"
                  required
                  minLength={2}
                />
              </Field>
              <div className="field-grid">
                <Field label="Login" htmlFor="usuario-login">
                  <input
                    id="usuario-login"
                    className="input"
                    value={usuarioForm.login}
                    onChange={(evento) =>
                      setUsuarioForm({ ...usuarioForm, login: evento.target.value })
                    }
                    placeholder="maria.silva"
                    autoCapitalize="none"
                    spellCheck="false"
                    required
                    minLength={3}
                  />
                </Field>
                <Field label="Perfil" htmlFor="usuario-perfil">
                  <select
                    id="usuario-perfil"
                    className="select"
                    value={usuarioForm.perfil}
                    onChange={(evento) =>
                      setUsuarioForm({ ...usuarioForm, perfil: evento.target.value })
                    }
                  >
                    {PERFIS.map((perfil) => (
                      <option key={perfil} value={perfil}>
                        {rotuloPerfil(perfil)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Senha inicial" htmlFor="usuario-senha" hint="Mínimo de 6 caracteres.">
                <div className="input-group">
                  <input
                    id="usuario-senha"
                    className="input"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={usuarioForm.senha}
                    onChange={(evento) =>
                      setUsuarioForm({ ...usuarioForm, senha: evento.target.value })
                    }
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <Icon name={mostrarSenha ? 'eye-off' : 'eye'} size={18} />
                  </button>
                </div>
              </Field>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setUsuarioForm((atual) => ({ ...atual, senha: gerarSenha() }))
                  setMostrarSenha(true)
                }}
              >
                <Icon name="key" size={15} />
                Gerar senha segura
              </button>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={salvando === 'usuario'}
              >
                {salvando === 'usuario' ? <Spinner size={17} /> : <Icon name="plus" size={17} />}
                Cadastrar usuário
              </button>
            </form>
          </Card>

          <Card
            titulo="Usuários"
            descricao={usuarios ? `${usuarios.length} cadastrados` : 'Carregando…'}
            icone="users"
          >
            {!usuarios ? (
              <div className="loading-inline">
                <Spinner size={20} />
                <span>Carregando usuários…</span>
              </div>
            ) : usuarios.length === 0 ? (
              <EmptyState
                icone="users"
                titulo="Nenhum usuário"
                texto="Cadastre os usuários da unidade."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Login</th>
                      <th>Perfil</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((item) => (
                      <tr key={item.id}>
                        <td className="is-strong">{item.nome}</td>
                        <td className="is-mono">{item.login}</td>
                        <td>{rotuloPerfil(item.perfil)}</td>
                        <td>
                          <Badge tom={item.ativo ? 'success' : 'neutral'}>
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {aba === 'dispositivos' && ehAdmin && (
        <Card
          titulo="Dispositivos autorizados"
          descricao="Aparelhos vinculados aos usuários da unidade. Revogue o acesso em caso de perda ou troca."
          icone="smartphone"
        >
          {!dispositivos ? (
            <div className="loading-inline">
              <Spinner size={20} />
              <span>Carregando dispositivos…</span>
            </div>
          ) : dispositivos.length === 0 ? (
            <EmptyState
              icone="smartphone"
              titulo="Nenhum dispositivo"
              texto="Os aparelhos aparecem aqui após o primeiro acesso."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dispositivo</th>
                    <th>Usuário</th>
                    <th>Último acesso</th>
                    <th>Situação</th>
                    <th className="is-actions">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {dispositivos.map((item) => (
                    <tr key={item.id}>
                      <td className="is-strong">{item.nome || 'Aparelho sem nome'}</td>
                      <td>
                        {item.usuario_nome || '—'}
                        {item.usuario_login && (
                          <span className="cell-sub">@{item.usuario_login}</span>
                        )}
                      </td>
                      <td>{item.ultimo_acesso ? dataHora(item.ultimo_acesso) : '—'}</td>
                      <td>
                        <Badge tom={item.revogado ? 'danger' : 'success'}>
                          {item.revogado ? 'Revogado' : 'Ativo'}
                        </Badge>
                      </td>
                      <td className="is-actions">
                        {!item.revogado && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => revogarDispositivo(item)}
                            disabled={salvando === item.id}
                          >
                            {salvando === item.id ? (
                              <Spinner size={15} />
                            ) : (
                              <Icon name="shield-off" size={15} />
                            )}
                            Revogar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
