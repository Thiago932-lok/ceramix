import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'
import { salvarRegistro } from '../lib/registros'
import { hoje, numero } from '../lib/format'
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

const PASSOS = ['Turno e data', 'Produto', 'Quantidades', 'Revisão']

export default function NovaProducao() {
  const { online, getCatalogo, sincronizar, atualizarContagem } = useSync()
  const { sucesso, info } = useToast()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(0)
  const [catalogo, setCatalogo] = useState(null)
  const [busca, setBusca] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [dataProducao, setDataProducao] = useState(hoje())
  const [produtoId, setProdutoId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [produzida, setProduzida] = useState('')
  const [refugo, setRefugo] = useState('0')
  const [motivoId, setMotivoId] = useState('')
  const [argila, setArgila] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregarCatalogo = useCallback(async () => {
    const dados = await getCatalogo()
    setCatalogo(dados)
    if (dados.turnos.length === 1) setTurnoId(dados.turnos[0].id)
  }, [getCatalogo])

  useEffect(() => {
    carregarCatalogo()
  }, [carregarCatalogo])

  const turno = catalogo?.turnos.find((item) => item.id === turnoId)
  const produto = catalogo?.produtos.find((item) => item.id === produtoId)
  const motivo = catalogo?.motivos_refugo.find((item) => item.id === motivoId)
  const lotesProduto = useMemo(
    () => (catalogo?.lotes || []).filter((lote) => lote.produto_id === produtoId),
    [catalogo, produtoId]
  )
  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = catalogo?.produtos || []
    if (!termo) return lista
    return lista.filter(
      (item) =>
        item.nome.toLowerCase().includes(termo) || (item.codigo || '').toLowerCase().includes(termo)
    )
  }, [catalogo, busca])

  const qtdProduzida = Number(produzida)
  const qtdRefugo = Number(refugo || 0)
  const pecasBoas = Number.isFinite(qtdProduzida) ? Math.max(0, qtdProduzida - qtdRefugo) : 0

  if (!catalogo) {
    return (
      <div className="page">
        <PageHeader
          titulo="Registrar produção"
          descricao="Carregando turnos, produtos e motivos…"
        />
        <div className="loading-inline">
          <Spinner size={22} />
          <span>Carregando listas de apoio…</span>
        </div>
      </div>
    )
  }

  if (catalogo.turnos.length === 0 || catalogo.produtos.length === 0) {
    return (
      <div className="page">
        <PageHeader titulo="Registrar produção" descricao="Apontamento diário por turno." />
        <EmptyState
          icone="wifi-off"
          titulo="Listas de apoio indisponíveis"
          texto="Este aparelho ainda não baixou turnos e produtos. Conecte-se à internet e sincronize para começar."
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
      if (!turnoId) return setErro('Selecione o turno.')
      if (!dataProducao) return setErro('Informe a data da produção.')
      if (dataProducao > hoje()) return setErro('A data não pode ser futura.')
    }

    if (passo === 1 && !produtoId) {
      return setErro('Selecione o produto.')
    }

    if (passo === 2) {
      if (!Number.isInteger(qtdProduzida) || qtdProduzida <= 0) {
        return setErro('Informe a quantidade produzida em peças inteiras.')
      }
      if (!Number.isInteger(qtdRefugo) || qtdRefugo < 0) {
        return setErro('A quantidade de refugo é inválida.')
      }
      if (qtdRefugo > qtdProduzida) {
        return setErro('O refugo não pode ser maior que a produção.')
      }
      if (qtdRefugo > 0 && !motivoId) {
        return setErro('Selecione o motivo do refugo.')
      }
    }

    setPasso((atual) => Math.min(atual + 1, PASSOS.length - 1))
  }

  function voltar() {
    setErro('')
    setPasso((atual) => Math.max(atual - 1, 0))
  }

  async function confirmar() {
    setErro('')
    setEnviando(true)
    const id = uuid()

    const payload = {
      id,
      turno_id: turnoId,
      data_producao: dataProducao,
      criado_em_cliente: new Date().toISOString(),
      observacao: observacao || null,
      itens: [
        {
          id: uuid(),
          produto_id: produtoId,
          lote_id: loteId || null,
          quantidade_produzida: qtdProduzida,
          quantidade_refugo: qtdRefugo,
          motivo_refugo_id: qtdRefugo > 0 ? motivoId : null,
          consumo_argila: argila ? Number(argila.replace(',', '.')) : null
        }
      ]
    }

    try {
      const resultado = await salvarRegistro({
        tipo: 'producao',
        payload,
        online,
        atualizarContagem,
        sincronizar
      })

      if (resultado.destino === 'servidor') {
        sucesso('Produção registrada no servidor.')
        navigate('/producoes')
      } else {
        info('Sem conexão: produção salva no aparelho e na fila de envio.')
        navigate('/pendentes')
      }
    } catch (falha) {
      setErro(falha.message || 'Não foi possível salvar a produção.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="page page--form">
      <PageHeader
        titulo="Registrar produção"
        descricao="Apontamento do turno com refugo e consumo de argila."
      />

      <Stepper passos={PASSOS} atual={passo} />

      {erro && (
        <Callout tom="danger" titulo="Verifique os dados">
          {erro}
        </Callout>
      )}

      {passo === 0 && (
        <section className="card card--pad">
          <div className="field">
            <span className="field-label">Data da produção</span>
            <input
              className="input"
              type="date"
              value={dataProducao}
              max={hoje()}
              onChange={(evento) => setDataProducao(evento.target.value)}
            />
            <p className="field-hint">Use a data do turno, não a data do lançamento.</p>
          </div>

          <div className="field">
            <span className="field-label">Turno</span>
            <div className="choice-grid">
              {catalogo.turnos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`choice ${turnoId === item.id ? 'is-selected' : ''}`}
                  aria-pressed={turnoId === item.id}
                  onClick={() => setTurnoId(item.id)}
                >
                  <span className="choice-main">{item.nome}</span>
                  <span className="choice-meta">
                    {item.hora_inicio} – {item.hora_fim}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {passo === 1 && (
        <section className="card card--pad">
          <Field label="Buscar produto" htmlFor="busca-produto">
            <div className="input-group">
              <input
                id="busca-produto"
                className="input"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Nome ou código"
                autoComplete="off"
              />
              <span className="input-affix">
                <Icon name="search" size={17} />
              </span>
            </div>
          </Field>

          <div className="choice-grid choice-grid--split">
            {produtosFiltrados.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`choice ${produtoId === item.id ? 'is-selected' : ''}`}
                aria-pressed={produtoId === item.id}
                onClick={() => {
                  setProdutoId(item.id)
                  setLoteId('')
                }}
              >
                <span className="choice-main">{item.nome}</span>
                <span className="choice-meta">
                  {item.codigo} · {item.unidade}
                </span>
              </button>
            ))}
          </div>

          {produtosFiltrados.length === 0 && (
            <p className="muted">Nenhum produto encontrado para “{busca}”.</p>
          )}
        </section>
      )}

      {passo === 2 && (
        <section className="card card--pad">
          <div className="field-grid">
            <Field label="Quantidade produzida" htmlFor="produzida">
              <div className="input-group">
                <input
                  id="produzida"
                  className="input"
                  inputMode="numeric"
                  value={produzida}
                  onChange={(evento) => setProduzida(evento.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                />
                <span className="input-affix">peças</span>
              </div>
            </Field>

            <Field label="Refugo" htmlFor="refugo" hint="Peças descartadas no turno.">
              <div className="input-group">
                <input
                  id="refugo"
                  className="input"
                  inputMode="numeric"
                  value={refugo}
                  onChange={(evento) => setRefugo(evento.target.value.replace(/\D/g, ''))}
                />
                <span className="input-affix">peças</span>
              </div>
            </Field>
          </div>

          {qtdRefugo > 0 && (
            <Field label="Motivo do refugo" htmlFor="motivo">
              <select
                id="motivo"
                className="select"
                value={motivoId}
                onChange={(evento) => setMotivoId(evento.target.value)}
              >
                <option value="">Selecione o motivo</option>
                {catalogo.motivos_refugo.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="field-grid">
            <Field label="Consumo de argila (t)" htmlFor="argila" hint="Opcional.">
              <div className="input-group">
                <input
                  id="argila"
                  className="input"
                  inputMode="decimal"
                  value={argila}
                  onChange={(evento) => setArgila(evento.target.value)}
                  placeholder="0,0"
                />
                <span className="input-affix">t</span>
              </div>
            </Field>

            {lotesProduto.length > 0 && (
              <Field label="Lote (opcional)" htmlFor="lote">
                <select
                  id="lote"
                  className="select"
                  value={loteId}
                  onChange={(evento) => setLoteId(evento.target.value)}
                >
                  <option value="">Sem lote</option>
                  {lotesProduto.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.codigo}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Observação (opcional)" htmlFor="observacao">
            <textarea
              id="observacao"
              className="textarea"
              rows={2}
              maxLength={500}
              value={observacao}
              onChange={(evento) => setObservacao(evento.target.value)}
              placeholder="Alguma ocorrência do turno?"
            />
          </Field>

          <div className="summary-box">
            <SummaryRow rotulo="Peças produzidas" valor={numero(qtdProduzida || 0)} />
            <SummaryRow rotulo="Refugo" valor={numero(qtdRefugo || 0)} />
            <SummaryRow rotulo="Peças boas" valor={numero(pecasBoas)} destaque />
          </div>
        </section>
      )}

      {passo === 3 && (
        <section className="card card--pad">
          <div className="review-head">
            <span className="review-icon">
              <Icon name="clipboard" size={20} />
            </span>
            <div>
              <h2>Confirme o apontamento</h2>
              <p>Revise os dados antes de registrar.</p>
            </div>
          </div>

          <div className="summary-box">
            <SummaryRow
              rotulo="Data"
              valor={new Date(`${dataProducao}T12:00:00`).toLocaleDateString('pt-BR')}
            />
            <SummaryRow rotulo="Turno" valor={turno?.nome || '—'} />
            <SummaryRow rotulo="Produto" valor={produto?.nome || '—'} />
            <SummaryRow
              rotulo="Lote"
              valor={catalogo.lotes.find((l) => l.id === loteId)?.codigo || 'Sem lote'}
            />
            <SummaryRow rotulo="Produzidas" valor={numero(qtdProduzida)} />
            <SummaryRow
              rotulo="Refugo"
              valor={`${numero(qtdRefugo)}${motivo ? ` · ${motivo.nome}` : ''}`}
            />
            <SummaryRow rotulo="Peças boas" valor={numero(pecasBoas)} destaque />
            {argila && <SummaryRow rotulo="Argila" valor={`${argila} t`} />}
            {observacao && <SummaryRow rotulo="Observação" valor={observacao} />}
          </div>

          {!online && (
            <Callout tom="warning" titulo="Modo offline">
              O registro será salvo no aparelho e enviado automaticamente quando a conexão voltar.
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
                Confirmar produção
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
