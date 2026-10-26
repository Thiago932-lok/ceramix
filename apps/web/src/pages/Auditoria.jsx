import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { dataHora } from '../lib/format'
import { Callout, EmptyState, LoadingCards, PageHeader } from '../components/Ui'
import Icon from '../components/Icon'

const ACOES = {
  criar: { rotulo: 'Criação', icone: 'plus', tom: 'neutral' },
  validar: { rotulo: 'Validação', icone: 'check', tom: 'success' },
  cancelar: { rotulo: 'Cancelamento', icone: 'x', tom: 'danger' },
  confirmar: { rotulo: 'Confirmação', icone: 'map-pin', tom: 'success' },
  revogar: { rotulo: 'Revogação', icone: 'shield-off', tom: 'danger' },
  exportar: { rotulo: 'Exportação', icone: 'download', tom: 'info' },
  login: { rotulo: 'Acesso', icone: 'key', tom: 'info' },
  logout: { rotulo: 'Saída', icone: 'logout', tom: 'neutral' },
  login_falha: { rotulo: 'Falha de acesso', icone: 'shield-off', tom: 'danger' },
  login_bloqueado: { rotulo: 'Acesso bloqueado', icone: 'shield-off', tom: 'danger' },
  registro: { rotulo: 'Cadastro', icone: 'user', tom: 'success' }
}

const ENTIDADES = {
  producao: 'Produção',
  entrega: 'Entrega',
  usuario: 'Usuário',
  produto: 'Produto',
  lote: 'Lote',
  dispositivo: 'Dispositivo',
  relatorio: 'Relatório',
  sessao: 'Sessão',
  auth: 'Autenticação'
}

function formatarJson(valor) {
  if (!valor) return null
  try {
    return JSON.stringify(JSON.parse(valor), null, 2)
  } catch {
    return String(valor)
  }
}

export default function Auditoria() {
  const [lista, setLista] = useState(null)
  const [falha, setFalha] = useState('')
  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState('todas')

  const carregar = useCallback(async () => {
    setFalha('')
    try {
      setLista(await api('/relatorios/auditoria'))
    } catch (e) {
      setFalha(e.message)
      setLista([])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const acoesDisponiveis = useMemo(() => {
    const conjunto = new Set((lista || []).map((item) => item.acao))
    return Array.from(conjunto).sort()
  }, [lista])

  const exibidas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (lista || []).filter((item) => {
      if (acao !== 'todas' && item.acao !== acao) return false
      if (!termo) return true
      const entidade = ENTIDADES[item.entidade] || item.entidade
      const rotuloAcao = ACOES[item.acao]?.rotulo || item.acao
      return `${entidade} ${rotuloAcao} ${item.acao} ${item.usuario_nome || 'sistema'} ${item.entidade_id}`
        .toLowerCase()
        .includes(termo)
    })
  }, [lista, acao, busca])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Conformidade"
        titulo="Auditoria"
        descricao="Trilha append-only com criação, validação, cancelamento, acessos e exportações."
        acoes={
          <button type="button" className="btn btn-ghost" onClick={carregar}>
            <Icon name="refresh" size={16} />
            Atualizar
          </button>
        }
      />

      <Callout tom="info" titulo="Registro imutável">
        Cada evento guarda autor, data, IP e valores anterior e novo. Nenhum registro da auditoria
        pode ser alterado ou removido pelo aplicativo.
      </Callout>

      {falha && (
        <Callout tom="danger" titulo="Não foi possível carregar">
          {falha}
        </Callout>
      )}

      <div className="toolbar">
        <div className="input-group toolbar-search">
          <input
            className="input"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar usuário, entidade ou ID"
            aria-label="Buscar eventos"
          />
          <span className="input-affix">
            <Icon name="search" size={17} />
          </span>
        </div>

        <div className="field field--inline">
          <label className="field-label" htmlFor="acao">
            Ação
          </label>
          <select
            id="acao"
            className="select"
            value={acao}
            onChange={(evento) => setAcao(evento.target.value)}
          >
            <option value="todas">Todas as ações</option>
            {acoesDisponiveis.map((chave) => (
              <option key={chave} value={chave}>
                {ACOES[chave]?.rotulo || chave}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!lista ? (
        <LoadingCards quantidade={3} />
      ) : exibidas.length === 0 ? (
        <EmptyState
          icone="shield"
          titulo={
            lista.length === 0 ? 'Nenhum evento registrado' : 'Nada encontrado com esses filtros'
          }
          texto={
            lista.length === 0
              ? 'As ações da operação passam a aparecer aqui automaticamente.'
              : 'Ajuste a busca ou selecione outra ação.'
          }
        />
      ) : (
        <div className="event-list">
          {exibidas.map((evento) => {
            const meta = ACOES[evento.acao] || {
              rotulo: evento.acao,
              icone: 'info',
              tom: 'neutral'
            }
            const anterior = formatarJson(evento.valor_antigo)
            const novo = formatarJson(evento.valor_novo)

            return (
              <article className="event" key={evento.id}>
                <span className={`event-icon event-icon--${meta.tom}`}>
                  <Icon name={meta.icone} size={17} />
                </span>

                <div className="event-body">
                  <div className="event-head">
                    <h2 className="event-title">
                      {meta.rotulo} · {ENTIDADES[evento.entidade] || evento.entidade}
                    </h2>
                    <span className="event-time">{dataHora(evento.criado_em)}</span>
                  </div>

                  <p className="event-meta">
                    <Icon name="user" size={13} />
                    {evento.usuario_nome || 'Sistema'}
                    {evento.ip && (
                      <>
                        <span className="record-sep">·</span>
                        IP {evento.ip}
                      </>
                    )}
                    {evento.entidade_id && (
                      <>
                        <span className="record-sep">·</span>
                        <span className="is-mono">{evento.entidade_id.slice(0, 8)}</span>
                      </>
                    )}
                  </p>

                  {(anterior || novo) && (
                    <details className="event-details">
                      <summary>Ver detalhes da alteração</summary>
                      <div className="event-values">
                        {anterior && (
                          <div>
                            <span className="event-values-label">Valor anterior</span>
                            <pre>{anterior}</pre>
                          </div>
                        )}
                        {novo && (
                          <div>
                            <span className="event-values-label">Valor novo</span>
                            <pre>{novo}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
