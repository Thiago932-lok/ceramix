import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { dataHora, hora, horas, numero, rotuloEvento } from '../lib/format'
import { PERFIS_ENTREGA, PERFIS_GESTAO, pertence } from '../lib/acessos'
import { Badge, Callout, EmptyState, LoadingCards, PageHeader, Spinner } from '../components/Ui'
import Icon from '../components/Icon'

const FILTROS = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'andamento', rotulo: 'Em andamento' },
  { chave: 'entregue', rotulo: 'Entregues' },
  { chave: 'cancelada', rotulo: 'Canceladas' }
]

function capturarGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null })
    navigator.geolocation.getCurrentPosition(
      (posicao) => resolve({ lat: posicao.coords.latitude, lng: posicao.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

function estaEmAndamento(status) {
  return status === 'saida_registrada' || status === 'em_transito'
}

export default function Entregas() {
  const { usuario } = useAuth()
  const { confirmar, pedirTexto } = useDialogs()
  const { sucesso, erro: avisarErro } = useToast()

  const [lista, setLista] = useState(null)
  const [falha, setFalha] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [processando, setProcessando] = useState('')
  const [timeline, setTimeline] = useState(null)
  const [carregandoTimeline, setCarregandoTimeline] = useState('')

  const podeConfirmar = pertence(usuario.perfil, PERFIS_ENTREGA)
  const podeCancelar = pertence(usuario.perfil, PERFIS_GESTAO)

  const carregar = useCallback(async () => {
    setFalha('')
    try {
      setLista(await api('/entregas'))
    } catch (e) {
      setFalha(e.message)
      setLista([])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const contagens = useMemo(() => {
    const base = { todas: lista?.length || 0, andamento: 0, entregue: 0, cancelada: 0 }
    for (const item of lista || []) {
      if (estaEmAndamento(item.status)) base.andamento += 1
      else if (item.status === 'entregue') base.entregue += 1
      else if (item.status === 'cancelada') base.cancelada += 1
    }
    return base
  }, [lista])

  const exibidas = useMemo(() => {
    return (lista || []).filter((item) => {
      if (filtro === 'todas') return true
      if (filtro === 'andamento') return estaEmAndamento(item.status)
      return item.status === filtro
    })
  }, [lista, filtro])

  async function verTimeline(item) {
    if (timeline?.entrega?.id === item.id) {
      setTimeline(null)
      return
    }
    setCarregandoTimeline(item.id)
    try {
      setTimeline(await api(`/entregas/${item.id}/timeline`))
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setCarregandoTimeline('')
    }
  }

  async function confirmarChegada(item) {
    const ok = await confirmar({
      titulo: 'Confirmar chegada?',
      mensagem: `A entrega para ${item.obra_nome} será marcada como concluída. As coordenadas GPS serão registradas quando disponíveis.`,
      textoConfirmar: 'Confirmar chegada',
      icone: 'map-pin'
    })
    if (!ok) return null

    setProcessando(item.id)
    try {
      const gps = await capturarGps()
      await api(`/entregas/${item.id}/confirmar`, { method: 'POST', body: gps })
      sucesso('Chegada confirmada.')
      if (timeline?.entrega?.id === item.id) setTimeline(null)
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
      titulo: 'Cancelar entrega',
      mensagem: 'A carga volta ao saldo dos lotes e o cancelamento fica registrado na auditoria.',
      rotulo: 'Motivo do cancelamento',
      placeholder: 'Ex.: veículo indisponível na saída',
      textoConfirmar: 'Cancelar entrega',
      textoCancelar: 'Voltar',
      perigo: true,
      minimo: 5
    })
    if (!motivo) return null

    setProcessando(item.id)
    try {
      await api(`/entregas/${item.id}/cancelar`, { method: 'POST', body: { motivo } })
      sucesso('Entrega cancelada e saldo devolvido ao lote.')
      if (timeline?.entrega?.id === item.id) setTimeline(null)
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
        titulo="Entregas"
        descricao="Saída, chegada e linha do tempo de cada carga expedida."
        acoes={
          <Link className="btn btn-primary" to="/entrega/nova">
            <Icon name="truck" size={17} />
            Nova entrega
          </Link>
        }
      />

      {falha && (
        <Callout tom="danger" titulo="Não foi possível carregar">
          {falha}
        </Callout>
      )}

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Filtrar entregas">
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
      </div>

      {!lista ? (
        <LoadingCards quantidade={3} />
      ) : exibidas.length === 0 ? (
        <EmptyState
          icone="package"
          titulo={
            lista.length === 0 ? 'Nenhuma entrega registrada' : 'Nada encontrado com esse filtro'
          }
          texto={
            lista.length === 0
              ? 'As saídas de carga aparecem aqui assim que são registradas.'
              : 'Selecione outra situação para ver as entregas.'
          }
          acao={
            <Link className="btn btn-primary" to="/entrega/nova">
              <Icon name="plus" size={17} />
              Registrar entrega
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {exibidas.map((item) => {
            const ocupado = processando === item.id
            const aberta = timeline?.entrega?.id === item.id
            const duracao =
              item.saida_em && item.chegada_em
                ? (new Date(item.chegada_em) - new Date(item.saida_em)) / 3_600_000
                : null

            return (
              <article className="record" key={item.id}>
                <header className="record-head">
                  <div>
                    <h2 className="record-title">
                      <Icon name="building" size={18} />
                      {item.obra_nome}
                    </h2>
                    <p className="record-meta">
                      <Icon name="truck" size={14} />
                      {item.veiculo_placa}
                      <span className="record-sep">·</span>
                      <Icon name="user" size={14} />
                      {item.criado_por_nome}
                      <span className="record-sep">·</span>
                      <Icon name="clock" size={14} />
                      saída {hora(item.saida_em)}
                      {item.chegada_em && ` · chegada ${hora(item.chegada_em)}`}
                      {duracao !== null && duracao >= 0 && ` · ${horas(duracao)}`}
                    </p>
                  </div>
                  <Badge status={item.status} />
                </header>

                <div className="record-body">
                  {item.itens.map((linha) => (
                    <div className="item-line" key={linha.id}>
                      <span className="item-line-main">
                        {linha.produto_nome}
                        <span className="item-line-code">{linha.lote_codigo}</span>
                      </span>
                      <span className="item-line-meta">{numero(linha.quantidade)} peças</span>
                    </div>
                  ))}

                  {item.observacao && (
                    <p className="record-note">
                      <Icon name="file-text" size={14} />
                      {item.observacao}
                    </p>
                  )}

                  {item.status === 'cancelada' && item.motivo_cancelamento && (
                    <p className="record-note record-note--danger">
                      <Icon name="alert" size={14} />
                      Cancelada: {item.motivo_cancelamento}
                    </p>
                  )}
                </div>

                <footer className="record-foot">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => verTimeline(item)}
                    aria-expanded={aberta}
                  >
                    {carregandoTimeline === item.id ? (
                      <Spinner size={16} />
                    ) : (
                      <Icon name={aberta ? 'chevron-down' : 'clock'} size={16} />
                    )}
                    {aberta ? 'Ocultar rastreio' : 'Linha do tempo'}
                  </button>

                  {podeConfirmar && estaEmAndamento(item.status) && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => confirmarChegada(item)}
                      disabled={ocupado}
                    >
                      <Icon name="map-pin" size={16} />
                      Confirmar chegada
                    </button>
                  )}

                  {podeCancelar && estaEmAndamento(item.status) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => cancelar(item)}
                      disabled={ocupado}
                    >
                      <Icon name="x" size={16} />
                      Cancelar
                    </button>
                  )}
                </footer>

                {aberta && (
                  <div className="timeline-wrap">
                    <h3 className="timeline-title">Rastreio da carga</h3>
                    {timeline.eventos.length === 0 ? (
                      <p className="muted">Nenhum evento de rastreio registrado.</p>
                    ) : (
                      <ol className="timeline">
                        {timeline.eventos.map((evento) => (
                          <li className="timeline-item" key={evento.id}>
                            <span className="timeline-dot" aria-hidden="true" />
                            <div className="timeline-body">
                              <strong>{rotuloEvento(evento.tipo)}</strong>
                              <span className="timeline-meta">
                                {dataHora(evento.criado_em)}
                                {evento.usuario_nome && ` · ${evento.usuario_nome}`}
                                {evento.lote_codigo && ` · lote ${evento.lote_codigo}`}
                              </span>
                              {evento.lat != null && evento.lng != null && (
                                <span className="timeline-gps">
                                  <Icon name="map-pin" size={13} />
                                  {Number(evento.lat).toFixed(5)}, {Number(evento.lng).toFixed(5)}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
