import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarPendentes, atualizarOutbox } from '../lib/db'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'
import { dataHora, hora, rotuloTipo } from '../lib/format'
import { Badge, Callout, EmptyState, PageHeader, Spinner } from '../components/Ui'
import Icon from '../components/Icon'

export default function Pendentes() {
  const { sincronizar, sincronizando, atualizarContagem, online, pendentes, ultimaSync } = useSync()
  const { sucesso, info, erro: avisarErro } = useToast()
  const [itens, setItens] = useState(null)
  const [reenviando, setReenviando] = useState('')

  const carregar = useCallback(async () => {
    setItens(await listarPendentes())
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar, sincronizando])

  async function sincronizarTudo() {
    if (!online) {
      info('Sem conexão. Os registros continuam salvos neste aparelho.')
      return
    }
    const rejeitados = (itens || []).filter((item) => item.status === 'REJEITADO')
    for (const item of rejeitados) {
      await atualizarOutbox(item.id, { status: 'PENDENTE', erro: null })
    }
    await atualizarContagem()
    await sincronizar()
    await carregar()
    sucesso('Sincronização concluída.')
  }

  async function reenviarItem(item) {
    if (!online) {
      info('Sem conexão. Tente novamente quando o sinal voltar.')
      return
    }
    setReenviando(item.id)
    try {
      await atualizarOutbox(item.id, { status: 'PENDENTE', erro: null })
      await atualizarContagem()
      await sincronizar()
      await carregar()
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setReenviando('')
    }
  }

  const rejeitados = (itens || []).filter((item) => item.status === 'REJEITADO').length

  return (
    <div className="page">
      <PageHeader
        titulo="Fila offline"
        descricao="Registros salvos neste aparelho aguardando envio ao servidor."
        acoes={
          <button
            type="button"
            className="btn btn-primary"
            onClick={sincronizarTudo}
            disabled={sincronizando || !itens?.length}
          >
            {sincronizando ? <Spinner size={17} /> : <Icon name="refresh" size={17} />}
            {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        }
      />

      <section className={`card card--pad queue-summary ${online ? 'is-online' : 'is-offline'}`}>
        <div className="queue-summary-main">
          <span className="queue-icon">
            <Icon name={online ? 'wifi' : 'wifi-off'} size={20} />
          </span>
          <div>
            <strong>{online ? 'Conectado ao servidor' : 'Operando offline'}</strong>
            <p>
              {online
                ? 'A fila é enviada automaticamente a cada minuto e ao abrir o aplicativo.'
                : 'Os lançamentos ficam na fila local até a conexão ser restabelecida.'}
            </p>
          </div>
        </div>
        <div className="queue-stats">
          <div>
            <span>Pendentes</span>
            <strong>{pendentes}</strong>
          </div>
          <div>
            <span>Rejeitados</span>
            <strong>{rejeitados}</strong>
          </div>
          <div>
            <span>Última sync</span>
            <strong>{ultimaSync ? hora(ultimaSync) : '—'}</strong>
          </div>
        </div>
      </section>

      {rejeitados > 0 && (
        <Callout tom="warning" titulo="Registros rejeitados">
          O servidor recusou {rejeitados} {rejeitados === 1 ? 'registro' : 'registros'}. Confira a
          mensagem de erro e reenvie após corrigir a causa.
        </Callout>
      )}

      {!itens ? (
        <div className="loading-inline">
          <Spinner size={22} />
          <span>Lendo a fila local…</span>
        </div>
      ) : itens.length === 0 ? (
        <EmptyState
          icone="inbox"
          titulo="Fila vazia"
          texto="Todos os registros deste aparelho já foram enviados ao servidor."
          acao={
            <Link className="btn btn-ghost" to="/">
              <Icon name="home" size={17} />
              Voltar ao início
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {itens.map((item) => (
            <article className="record record--compact" key={item.id}>
              <header className="record-head">
                <div>
                  <h2 className="record-title">
                    <Icon name={item.tipo === 'producao' ? 'factory' : 'truck'} size={17} />
                    {rotuloTipo(item.tipo)}
                  </h2>
                  <p className="record-meta">
                    <Icon name="clock" size={14} />
                    {dataHora(item.criado_em)}
                    <span className="record-sep">·</span>
                    <span className="is-mono">{item.id.slice(0, 8)}</span>
                  </p>
                </div>
                <Badge status={item.status} />
              </header>

              {item.erro && (
                <p className="record-note record-note--danger">
                  <Icon name="alert" size={14} />
                  {item.erro}
                </p>
              )}

              {item.status === 'REJEITADO' && (
                <footer className="record-foot">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => reenviarItem(item)}
                    disabled={reenviando === item.id || sincronizando}
                  >
                    {reenviando === item.id ? (
                      <Spinner size={15} />
                    ) : (
                      <Icon name="rotate-ccw" size={15} />
                    )}
                    Reenviar
                  </button>
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
