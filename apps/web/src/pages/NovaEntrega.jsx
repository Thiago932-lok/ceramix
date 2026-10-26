import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'
import { salvarRegistro } from '../lib/registros'
import { numero } from '../lib/format'
import {
  Callout,
  EmptyState,
  Field,
  PageHeader,
  Spinner,
  Stepper,
  SummaryRow
} from '../components/Ui'
import Icon from '../components/Icon'

const PASSOS = ['Lote e quantidade', 'Obra', 'Veículo', 'Confirmação']

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

export default function NovaEntrega() {
  const { online, getCatalogo, sincronizar, atualizarContagem } = useSync()
  const { sucesso, info } = useToast()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(0)
  const [catalogo, setCatalogo] = useState(null)
  const [loteId, setLoteId] = useState('')
  const [obraId, setObraId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregarCatalogo = useCallback(async () => {
    setCatalogo(await getCatalogo())
  }, [getCatalogo])

  useEffect(() => {
    carregarCatalogo()
  }, [carregarCatalogo])

  const lotesDisponiveis = useMemo(() => {
    const lista = catalogo?.lotes || []
    return lista.filter((lote) => lote.quantidade_produzida - lote.quantidade_expedida > 0)
  }, [catalogo])

  const lote = catalogo?.lotes.find((item) => item.id === loteId)
  const obra = catalogo?.obras.find((item) => item.id === obraId)
  const veiculo = catalogo?.veiculos.find((item) => item.id === veiculoId)
  const produto = catalogo?.produtos.find((item) => item.id === lote?.produto_id)
  const saldo = lote ? lote.quantidade_produzida - lote.quantidade_expedida : 0
  const qtd = Number(quantidade)

  const lotesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lotesDisponiveis
    return lotesDisponiveis.filter((item) => {
      const nome = catalogo?.produtos.find((p) => p.id === item.produto_id)?.nome || ''
      return item.codigo.toLowerCase().includes(termo) || nome.toLowerCase().includes(termo)
    })
  }, [lotesDisponiveis, catalogo, busca])

  if (!catalogo) {
    return (
      <div className="page">
        <PageHeader titulo="Nova entrega" descricao="Carregando lotes, obras e veículos…" />
        <div className="loading-inline">
          <Spinner size={22} />
          <span>Carregando listas de apoio…</span>
        </div>
      </div>
    )
  }

  if (
    lotesDisponiveis.length === 0 ||
    catalogo.obras.length === 0 ||
    catalogo.veiculos.length === 0
  ) {
    return (
      <div className="page">
        <PageHeader titulo="Nova entrega" descricao="Saída de carga por lote, obra e veículo." />
        <EmptyState
          icone="wifi-off"
          titulo="Listas de apoio incompletas"
          texto="É necessário ter ao menos um lote com saldo, uma obra e um veículo cadastrados. Sincronize para atualizar."
          acao={
            <button type="button" className="btn btn-primary" onClick={sincronizar}>
              <Icon name="refresh" size={17} />
              Sincronizar agora
            </button>
          }
        />
      </div>
    )
  }

  function avancar() {
    setErro('')

    if (passo === 0) {
      if (!loteId) return setErro('Selecione o lote a expedir.')
      if (!Number.isInteger(qtd) || qtd <= 0)
        return setErro('Informe a quantidade em peças inteiras.')
      if (qtd > saldo)
        return setErro(`A quantidade excede o saldo disponível (${numero(saldo)} peças).`)
    }
    if (passo === 1 && !obraId) return setErro('Selecione a obra de destino.')
    if (passo === 2 && !veiculoId) return setErro('Selecione o veículo.')

    setPasso((atual) => Math.min(atual + 1, PASSOS.length - 1))
  }

  function voltar() {
    setErro('')
    setPasso((atual) => Math.max(atual - 1, 0))
  }

  async function confirmar() {
    setErro('')
    setEnviando(true)

    try {
      const gps = await capturarGps()
      const agora = new Date().toISOString()
      const id = uuid()
      const payload = {
        id,
        obra_id: obraId,
        veiculo_id: veiculoId,
        observacao: observacao || null,
        saida_em: agora,
        saida_lat: gps.lat,
        saida_lng: gps.lng,
        criado_em_cliente: agora,
        itens: [
          {
            id: uuid(),
            lote_id: loteId,
            produto_id: lote.produto_id,
            quantidade: qtd
          }
        ]
      }

      const resultado = await salvarRegistro({
        tipo: 'entrega',
        payload,
        online,
        atualizarContagem,
        sincronizar
      })

      if (resultado.destino === 'servidor') {
        sucesso('Saída registrada no servidor.')
        navigate('/entregas')
      } else {
        info('Sem conexão: entrega salva no aparelho e na fila de envio.')
        navigate('/pendentes')
      }
    } catch (falha) {
      setErro(falha.message || 'Não foi possível registrar a entrega.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="page page--form">
      <PageHeader
        titulo="Nova entrega"
        descricao="Registre a saída da carga. O GPS é capturado quando o navegador permite."
      />

      <Stepper passos={PASSOS} atual={passo} />

      {erro && (
        <Callout tom="danger" titulo="Verifique os dados">
          {erro}
        </Callout>
      )}

      {passo === 0 && (
        <section className="card card--pad">
          <Field label="Buscar lote" htmlFor="busca-lote">
            <div className="input-group">
              <input
                id="busca-lote"
                className="input"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Código do lote ou produto"
                autoComplete="off"
              />
              <span className="input-affix">
                <Icon name="search" size={17} />
              </span>
            </div>
          </Field>

          <div className="choice-grid choice-grid--split">
            {lotesFiltrados.map((item) => {
              const nome = catalogo.produtos.find((p) => p.id === item.produto_id)?.nome
              const disponivel = item.quantidade_produzida - item.quantidade_expedida
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`choice ${loteId === item.id ? 'is-selected' : ''}`}
                  aria-pressed={loteId === item.id}
                  onClick={() => {
                    setLoteId(item.id)
                    setQuantidade('')
                  }}
                >
                  <span className="choice-main">{item.codigo}</span>
                  <span className="choice-meta">
                    {nome} · saldo {numero(disponivel)}
                  </span>
                </button>
              )
            })}
          </div>

          {lotesFiltrados.length === 0 && (
            <p className="muted">Nenhum lote com saldo encontrado para “{busca}”.</p>
          )}

          <Field
            label="Quantidade a expedir"
            htmlFor="quantidade"
            hint={
              lote
                ? `Saldo disponível: ${numero(saldo)} peças.`
                : 'Escolha um lote para ver o saldo.'
            }
          >
            <div className="input-group">
              <input
                id="quantidade"
                className="input"
                inputMode="numeric"
                value={quantidade}
                onChange={(evento) => setQuantidade(evento.target.value.replace(/\D/g, ''))}
                placeholder="0"
                disabled={!loteId}
              />
              <span className="input-affix">peças</span>
            </div>
          </Field>

          <Field label="Observação (opcional)" htmlFor="observacao">
            <textarea
              id="observacao"
              className="textarea"
              rows={2}
              maxLength={500}
              value={observacao}
              onChange={(evento) => setObservacao(evento.target.value)}
              placeholder="Instruções de entrega, motorista, ocorrências…"
            />
          </Field>
        </section>
      )}

      {passo === 1 && (
        <section className="card card--pad">
          <div className="choice-grid choice-grid--split">
            {catalogo.obras.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${obraId === item.id ? 'is-selected' : ''}`}
                aria-pressed={obraId === item.id}
                onClick={() => setObraId(item.id)}
              >
                <span className="choice-main">{item.nome}</span>
                {(item.endereco || item.cidade) && (
                  <span className="choice-meta">
                    {[item.endereco, item.cidade].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {passo === 2 && (
        <section className="card card--pad">
          <div className="choice-grid choice-grid--split">
            {catalogo.veiculos.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${veiculoId === item.id ? 'is-selected' : ''}`}
                aria-pressed={veiculoId === item.id}
                onClick={() => setVeiculoId(item.id)}
              >
                <span className="choice-main">{item.placa}</span>
                <span className="choice-meta">{item.descricao || 'Veículo da frota'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {passo === 3 && (
        <section className="card card--pad">
          <div className="review-head">
            <span className="review-icon">
              <Icon name="truck" size={20} />
            </span>
            <div>
              <h2>Confirme a saída</h2>
              <p>Revise a carga antes de registrar.</p>
            </div>
          </div>

          <div className="summary-box">
            <SummaryRow rotulo="Lote" valor={lote?.codigo || '—'} />
            <SummaryRow rotulo="Produto" valor={produto?.nome || '—'} />
            <SummaryRow rotulo="Quantidade" valor={`${numero(qtd)} peças`} destaque />
            <SummaryRow rotulo="Obra" valor={obra?.nome || '—'} />
            <SummaryRow rotulo="Veículo" valor={veiculo?.placa || '—'} />
            {observacao && <SummaryRow rotulo="Observação" valor={observacao} />}
          </div>

          {!online ? (
            <Callout tom="warning" titulo="Modo offline">
              A entrega será salva no aparelho e enviada automaticamente quando a conexão voltar.
            </Callout>
          ) : (
            <Callout tom="info" titulo="Localização da saída">
              Ao confirmar, o app tenta registrar as coordenadas GPS deste dispositivo.
            </Callout>
          )}
        </section>
      )}

      <div className="wizard-footer">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={voltar}
          disabled={passo === 0 || enviando}
        >
          <Icon name="arrow-left" size={17} />
          Voltar
        </button>
        {passo < PASSOS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={avancar}>
            Continuar
            <Icon name="arrow-right" size={17} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={enviando}>
            {enviando ? (
              <>
                <Spinner size={17} />
                Salvando…
              </>
            ) : (
              <>
                <Icon name="check" size={17} />
                Confirmar saída
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
