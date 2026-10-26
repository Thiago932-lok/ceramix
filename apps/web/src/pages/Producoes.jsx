import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { useSync } from '../context/SyncContext'
import { data, dataHora, decimal, numero } from '../lib/format'
import { PERFIS_GESTAO, pertence } from '../lib/acessos'
import { Badge, Callout, EmptyState, LoadingCards, PageHeader } from '../components/Ui'
import Icon from '../components/Icon'

const FILTROS = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'pendente_validacao', rotulo: 'Aguardando validação' },
  { chave: 'validado', rotulo: 'Validadas' },
  { chave: 'cancelado', rotulo: 'Canceladas' }
]

export default function Producoes() {
  const { usuario } = useAuth()
  const { confirmar, pedirTexto } = useDialogs()
  const { sucesso, erro: avisarErro } = useToast()
  const { sincronizar } = useSync()

  const [lista, setLista] = useState(null)
  const [falha, setFalha] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [processando, setProcessando] = useState('')

  const podeValidar = pertence(usuario.perfil, PERFIS_GESTAO)

  const carregar = useCallback(async () => {
    setFalha('')
    try {
      setLista(await api('/producoes'))
    } catch (e) {
      setFalha(e.message)
      setLista([])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const contagens = useMemo(() => {
    const base = { todas: lista?.length || 0, pendente_validacao: 0, validado: 0, cancelado: 0 }
    for (const item of lista || []) base[item.status] = (base[item.status] || 0) + 1
    return base
  }, [lista])

  const exibidas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (lista || []).filter((item) => {
      if (filtro !== 'todas' && item.status !== filtro) return false
      if (!termo) return true
      const itens = (item.itens || []).map((i) => i.produto_nome).join(' ')
      return `${item.turno_nome} ${item.criado_por_nome} ${itens} ${item.data_producao}`
        .toLowerCase()
        .includes(termo)
    })
  }, [lista, filtro, busca])

  async function validar(item) {
    const ok = await confirmar({
      titulo: 'Validar produção?',
      mensagem: `Produção de ${data(item.data_producao)} no ${item.turno_nome}. Após validada, o registro entra nos indicadores.`,
      textoConfirmar: 'Validar',
      icone: 'check'
    })
    if (!ok) return null

    setProcessando(item.id)
    try {
      await api(`/producoes/${item.id}/validar`, { method: 'POST', body: {} })
      sucesso('Produção validada.')
      await carregar()
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setProcessando('')
    }
    return undefined
  }

  async function cancelar(item) {
    const motivo = await pedirTexto({
      titulo: 'Cancelar produção',
      mensagem:
        'O cancelamento é definitivo e devolve as peças ao saldo do lote. Informe o motivo para a auditoria.',
      rotulo: 'Motivo do cancelamento',
      placeholder: 'Ex.: apontamento duplicado do turno',
      textoConfirmar: 'Cancelar produção',
      textoCancelar: 'Voltar',
      perigo: true,
      minimo: 5
    })
    if (!motivo) return null

    setProcessando(item.id)
    try {
      await api(`/producoes/${item.id}/cancelar`, { method: 'POST', body: { motivo } })
      sucesso('Produção cancelada e estoque revertido.')
      await carregar()
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setProcessando('')
    }
    return undefined
  }

  return (
    <div className="page">
      <PageHeader
        titulo="Produções"
        descricao="Registros recebidos pelo servidor, com validação e cancelamento auditados."
        acoes={
          <>
            <button type="button" className="btn btn-ghost" onClick={sincronizar}>
              <Icon name="refresh" size={16} />
              Sincronizar
            </button>
            <Link className="btn btn-primary" to="/producao/nova">
              <Icon name="plus" size={17} />
              Nova produção
            </Link>
          </>
        }
      />

      {falha && (
        <Callout tom="danger" titulo="Não foi possível carregar">
          {falha}
        </Callout>
      )}

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Filtrar por situação">
          {FILTROS.map((item) => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={filtro === item.chave}
              className={`segment ${filtro === item.chave ? 'is-active' : ''}`}
              onClick={() => setFiltro(item.chave)}
            >
              {item.rotulo}
              <span className="segment-count">{contagens[item.chave] || 0}</span>
            </button>
          ))}
        </div>

        <div className="input-group toolbar-search">
          <input
            className="input"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar turno, produto ou operador"
            aria-label="Buscar produções"
          />
          <span className="input-affix">
            <Icon name="search" size={17} />
          </span>
        </div>
      </div>

      {!lista ? (
        <LoadingCards quantidade={3} />
      ) : exibidas.length === 0 ? (
        <EmptyState
          icone="factory"
          titulo={
            lista.length === 0 ? 'Nenhuma produção registrada' : 'Nada encontrado com esses filtros'
          }
          texto={
            lista.length === 0
              ? 'Os apontamentos enviados pelos turnos aparecem aqui.'
              : 'Ajuste a busca ou selecione outra situação.'
          }
          acao={
            lista.length === 0 ? (
              <Link className="btn btn-primary" to="/producao/nova">
                <Icon name="plus" size={17} />
                Registrar produção
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setFiltro('todas')
                  setBusca('')
                }}
              >
                Limpar filtros
              </button>
            )
          }
        />
      ) : (
        <div className="stack">
          {exibidas.map((item) => {
            const produzido = item.itens.reduce((soma, i) => soma + i.quantidade_produzida, 0)
            const refugo = item.itens.reduce((soma, i) => soma + i.quantidade_refugo, 0)
            const ocupado = processando === item.id

            return (
              <article className="record" key={item.id}>
                <header className="record-head">
                  <div>
                    <h2 className="record-title">
                      {data(item.data_producao)}
                      <span className="record-sep">·</span>
                      {item.turno_nome}
                    </h2>
                    <p className="record-meta">
                      <Icon name="user" size={14} />
                      {item.criado_por_nome}
                      <span className="record-sep">·</span>
                      <Icon name="clock" size={14} />
                      recebido em {dataHora(item.recebido_em_servidor)}
                    </p>
                  </div>
                  <Badge status={item.status} />
                </header>

                <div className="record-body">
                  {item.itens.map((linha) => (
                    <div className="item-line" key={linha.id}>
                      <span className="item-line-main">{linha.produto_nome}</span>
                      <span className="item-line-meta">
                        {numero(linha.quantidade_produzida)} produzidas
                        {linha.quantidade_refugo > 0 && (
                          <>
                            <span className="record-sep">·</span>
                            {numero(linha.quantidade_refugo)} refugo
                            {linha.motivo_nome && ` (${linha.motivo_nome})`}
                          </>
                        )}
                        {linha.consumo_argila > 0 && (
                          <>
                            <span className="record-sep">·</span>
                            {decimal(linha.consumo_argila)} t de argila
                          </>
                        )}
                      </span>
                    </div>
                  ))}

                  <div className="record-totais">
                    <span>
                      <strong>{numero(produzido)}</strong> produzidas
                    </span>
                    <span>
                      <strong>{numero(refugo)}</strong> refugo
                    </span>
                    <span>
                      <strong>{numero(produzido - refugo)}</strong> peças boas
                    </span>
                  </div>

                  {item.observacao && (
                    <p className="record-note">
                      <Icon name="file-text" size={14} />
                      {item.observacao}
                    </p>
                  )}
                </div>

                {podeValidar && item.status === 'pendente_validacao' && (
                  <footer className="record-foot">
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => validar(item)}
                      disabled={ocupado}
                    >
                      <Icon name="check" size={16} />
                      Validar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => cancelar(item)}
                      disabled={ocupado}
                    >
                      <Icon name="x" size={16} />
                      Cancelar
                    </button>
                  </footer>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
