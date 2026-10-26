import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, loadTokens } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { data, dataCurta, decimal, diasAtras, hoje, horas, numero, percentual } from '../lib/format'
import {
  BarList,
  Callout,
  Card,
  EmptyState,
  LoadingCards,
  MetaBar,
  PageHeader,
  Stat
} from '../components/Ui'
import Icon from '../components/Icon'

const PRESETS = [
  { rotulo: '7 dias', calcular: () => [diasAtras(6), hoje()] },
  { rotulo: '30 dias', calcular: () => [diasAtras(29), hoje()] },
  {
    rotulo: 'Mês atual',
    calcular: () => {
      const agora = new Date()
      const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1)
      const iso = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return [iso(primeiro), hoje()]
    }
  }
]

export default function Dashboard() {
  const { erro: avisarErro, sucesso } = useToast()
  const [de, setDe] = useState(() => diasAtras(6))
  const [ate, setAte] = useState(() => hoje())
  const [dados, setDados] = useState(null)
  const [falha, setFalha] = useState('')
  const [exportando, setExportando] = useState(false)

  const carregar = useCallback(async (inicio, fim) => {
    setFalha('')
    try {
      setDados(await api(`/relatorios/dashboard?de=${inicio}&ate=${fim}`))
    } catch (e) {
      setFalha(e.message)
      setDados(null)
    }
  }, [])

  useEffect(() => {
    carregar(diasAtras(6), hoje())
  }, [carregar])

  function aplicarPreset(preset) {
    const [inicio, fim] = preset.calcular()
    setDe(inicio)
    setAte(fim)
    carregar(inicio, fim)
  }

  async function exportar() {
    setExportando(true)
    try {
      const { accessToken } = loadTokens()
      const resposta = await fetch(`/api/relatorios/exportar?de=${de}&ate=${ate}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: 'include'
      })
      if (!resposta.ok) throw new Error('Não foi possível gerar o arquivo.')
      const blob = await resposta.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `producao_${de}_${ate}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      sucesso('Relatório exportado em CSV.')
    } catch (e) {
      avisarErro(e.message)
    } finally {
      setExportando(false)
    }
  }

  const evolucao = useMemo(
    () => (dados?.evolucao || []).map((item) => ({ ...item, rotulo: dataCurta(item.data) })),
    [dados]
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Indicadores"
        titulo="Painel gerencial"
        descricao="Meta, perdas, entregas e estoque considerando apenas a produção validada."
        acoes={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => carregar(de, ate)}>
              <Icon name="refresh" size={16} />
              Atualizar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportar}
              disabled={exportando || !dados}
            >
              <Icon name="download" size={17} />
              {exportando ? 'Gerando…' : 'Exportar CSV'}
            </button>
          </>
        }
      />

      <section className="card card--pad period-bar">
        <div className="period-fields">
          <div className="period-field">
            <span className="field-label">De</span>
            <input
              className="input"
              type="date"
              value={de}
              max={ate}
              onChange={(evento) => setDe(evento.target.value)}
            />
          </div>
          <div className="period-field">
            <span className="field-label">Até</span>
            <input
              className="input"
              type="date"
              value={ate}
              min={de}
              max={hoje()}
              onChange={(evento) => setAte(evento.target.value)}
            />
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => carregar(de, ate)}>
            Aplicar período
          </button>
        </div>
        <div className="period-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.rotulo}
              type="button"
              className="chip"
              onClick={() => aplicarPreset(preset)}
            >
              {preset.rotulo}
            </button>
          ))}
        </div>
      </section>

      {falha && (
        <Callout tom="danger" titulo="Não foi possível carregar os indicadores">
          {falha}
        </Callout>
      )}

      {!dados && !falha && <LoadingCards quantidade={2} />}

      {dados && (
        <>
          <div className="stat-grid">
            <Stat
              rotulo="Peças boas"
              valor={numero(dados.producao.pecas_boas)}
              detalhe={`${numero(dados.producao.total_produzido)} produzidas · ${numero(dados.producao.total_refugo)} refugo`}
              icone="factory"
            />
            <Stat
              rotulo="Atingimento da meta"
              valor={percentual(dados.producao.percentual_meta)}
              detalhe={`Meta de ${numero(dados.producao.meta_periodo)} peças no período`}
              icone="chart"
              tom={dados.producao.percentual_meta >= 100 ? 'success' : 'neutral'}
            />
            <Stat
              rotulo="Perdas por refugo"
              valor={percentual(dados.producao.percentual_perdas)}
              detalhe={`${decimal(dados.producao.argila_por_peca, 3)} t de argila por peça boa`}
              icone="alert"
              tom={dados.producao.percentual_perdas > 5 ? 'warning' : 'neutral'}
            />
            <Stat
              rotulo="Entregas"
              valor={
                dados.entregas.total > 0
                  ? `${numero(dados.entregas.entregues)}/${numero(dados.entregas.total)}`
                  : '—'
              }
              detalhe={
                dados.entregas.total > 0
                  ? `${numero(dados.entregas.pendentes)} em andamento · tempo médio ${horas(dados.entregas.tempo_medio_horas)}`
                  : 'Nenhuma entrega no período'
              }
              icone="truck"
              tom={dados.entregas.pendentes > 0 ? 'info' : 'neutral'}
            />
          </div>

          <section className="panel-grid">
            <Card
              titulo="Atingimento da meta"
              descricao={`${data(dados.periodo.de)} a ${data(dados.periodo.ate)}`}
              icone="chart"
              className="card--pad"
            >
              <MetaBar valor={dados.producao.pecas_boas} meta={dados.producao.meta_periodo} />
              <div className="summary-box">
                <div className="summary-row">
                  <span>Registros validados</span>
                  <strong>{numero(dados.producao.registros)}</strong>
                </div>
                <div className="summary-row">
                  <span>Aguardando validação</span>
                  <strong>{numero(dados.producao.pendentes_validacao)}</strong>
                </div>
                <div className="summary-row">
                  <span>Consumo de argila</span>
                  <strong>{decimal(dados.producao.total_argila, 1)} t</strong>
                </div>
              </div>
              {dados.producao.pendentes_validacao > 0 && (
                <Link className="link-inline" to="/producoes">
                  Revisar {numero(dados.producao.pendentes_validacao)} produções pendentes
                  <Icon name="arrow-right" size={15} />
                </Link>
              )}
            </Card>

            <Card
              titulo="Evolução diária"
              descricao="Peças produzidas por dia."
              icone="layers"
              className="card--pad"
            >
              <BarList
                dados={evolucao}
                labelKey="rotulo"
                valueKey="produzido"
                vazio="Nenhuma produção validada no período."
              />
            </Card>

            <Card titulo="Produção por produto" icone="package" className="card--pad">
              <BarList
                dados={dados.por_produto}
                labelKey="nome"
                valueKey="produzido"
                vazio="Sem produção validada no período."
              />
            </Card>

            <Card titulo="Produção por turno" icone="clock" className="card--pad">
              <BarList
                dados={dados.por_turno}
                labelKey="nome"
                valueKey="produzido"
                vazio="Sem produção validada no período."
              />
            </Card>

            <Card
              titulo="Perdas por motivo"
              descricao="Refugo apontado no período."
              icone="alert"
              className="card--pad"
            >
              <BarList
                dados={dados.por_motivo}
                labelKey="nome"
                valueKey="total"
                vazio="Nenhum refugo registrado."
              />
            </Card>

            <Card titulo="Entregas por obra" icone="building" className="card--pad">
              <BarList
                dados={dados.entregas.por_obra}
                labelKey="nome"
                valueKey="total"
                vazio="Nenhuma entrega no período."
              />
              <div className="summary-box">
                <div className="summary-row">
                  <span>Canceladas</span>
                  <strong>{numero(dados.entregas.canceladas)}</strong>
                </div>
                <div className="summary-row summary-row--destaque">
                  <span>Tempo médio saída → chegada</span>
                  <strong>{horas(dados.entregas.tempo_medio_horas)}</strong>
                </div>
              </div>
            </Card>
          </section>

          <Card
            titulo="Estoque por lote"
            descricao="Saldo calculado como produção menos expedição."
            icone="layers"
          >
            {dados.estoque_simples.length === 0 ? (
              <EmptyState
                icone="package"
                titulo="Nenhum lote ativo"
                texto="Cadastre lotes para acompanhar o estoque por lote."
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
                    {dados.estoque_simples.map((lote) => (
                      <tr key={lote.codigo}>
                        <td className="is-mono">{lote.codigo}</td>
                        <td>{lote.produto}</td>
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
        </>
      )}
    </div>
  )
}
