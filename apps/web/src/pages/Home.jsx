import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import {
  PERFIS_CADASTRO,
  PERFIS_ENTREGA,
  PERFIS_GESTAO,
  PERFIS_PRODUCAO,
  pertence
} from '../lib/acessos'
import {
  dataLonga,
  diasAtras,
  hoje,
  hora,
  numero,
  percentual,
  rotuloPerfil,
  saudacao
} from '../lib/format'
import { Badge, BarList, Callout, PageHeader, Stat } from '../components/Ui'
import Icon from '../components/Icon'

export default function Home() {
  const { usuario } = useAuth()
  const { online, pendentes, sincronizar, sincronizando, ultimaSync } = useSync()
  const [dados, setDados] = useState(null)
  const [indisponivel, setIndisponivel] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const resultado = await api(`/relatorios/dashboard?de=${diasAtras(6)}&ate=${hoje()}`)
      setDados(resultado)
      setIndisponivel(false)
    } catch {
      setIndisponivel(true)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar, online])

  const primeiroNome = usuario.nome.split(' ')[0]
  const perfil = usuario.perfil

  const atalhos = [
    pertence(perfil, PERFIS_PRODUCAO) && {
      para: '/producao/nova',
      icone: 'plus',
      titulo: 'Registrar produção',
      descricao: 'Quantidade, refugo e argila por turno',
      tipo: 'brand'
    },
    pertence(perfil, PERFIS_ENTREGA) && {
      para: '/entrega/nova',
      icone: 'truck',
      titulo: 'Nova entrega',
      descricao: 'Saída por lote, obra e veículo',
      tipo: 'brand'
    },
    {
      para: '/producoes',
      icone: 'factory',
      titulo: 'Produções',
      descricao: 'Histórico, validação e cancelamento',
      perfis: PERFIS_PRODUCAO
    },
    {
      para: '/entregas',
      icone: 'package',
      titulo: 'Entregas',
      descricao: 'Confirmação de chegada e rastreio',
      perfis: PERFIS_ENTREGA
    },
    {
      para: '/dashboard',
      icone: 'chart',
      titulo: 'Painel gerencial',
      descricao: 'Meta, perdas, estoque e entregas'
    },
    {
      para: '/pendentes',
      icone: 'layers',
      titulo: 'Fila offline',
      descricao: `${pendentes} registro${pendentes === 1 ? '' : 's'} aguardando envio`,
      contador: pendentes
    },
    pertence(perfil, PERFIS_GESTAO) && {
      para: '/auditoria',
      icone: 'shield',
      titulo: 'Auditoria',
      descricao: 'Rastreabilidade de cada operação',
      perfis: PERFIS_GESTAO
    },
    pertence(perfil, PERFIS_CADASTRO) && {
      para: '/cadastros',
      icone: 'settings',
      titulo: 'Cadastros',
      descricao: 'Produtos, lotes, usuários e dispositivos',
      perfis: PERFIS_CADASTRO
    }
  ].filter((atalho) => atalho && (!atalho.perfis || pertence(perfil, atalho.perfis)))

  return (
    <div className="page">
      <PageHeader
        eyebrow={dataLonga()}
        titulo={`${saudacao()}, ${primeiroNome}`}
        descricao={
          usuario.empresaNome
            ? `Visão rápida da operação de ${usuario.empresaNome} nos últimos sete dias.`
            : 'Visão rápida da operação dos últimos sete dias.'
        }
        acoes={<Badge tom="neutral">{rotuloPerfil(perfil)}</Badge>}
      />

      <section className={`home-hero ${online ? 'is-online' : 'is-offline'}`}>
        <div className="home-hero-main">
          <span className="home-hero-icon">
            <Icon name={online ? 'wifi' : 'wifi-off'} size={22} />
          </span>
          <div>
            <h2>{online ? 'Sistema conectado' : 'Operando offline'}</h2>
            <p>
              {online
                ? 'Os registros são enviados automaticamente ao servidor.'
                : 'Os lançamentos ficam salvos no aparelho e sobem quando a conexão voltar.'}
            </p>
          </div>
        </div>
        <div className="home-hero-meta">
          <div>
            <span>Fila local</span>
            <strong>{numero(pendentes)}</strong>
          </div>
          <div>
            <span>Última sincronização</span>
            <strong>{ultimaSync ? hora(ultimaSync) : '—'}</strong>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={sincronizar}
            disabled={sincronizando}
          >
            <Icon name="refresh" size={16} className={sincronizando ? 'spin' : ''} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </section>

      <div className="stat-grid">
        <Stat
          rotulo="Peças boas"
          valor={dados ? numero(dados.producao.pecas_boas) : '—'}
          detalhe="Produção validada"
          icone="factory"
        />
        <Stat
          rotulo="Atingimento da meta"
          valor={dados ? percentual(dados.producao.percentual_meta) : '—'}
          detalhe={dados ? `${numero(dados.producao.meta_periodo)} peças planejadas` : 'Sem dados'}
          icone="chart"
          tom={dados && dados.producao.percentual_meta >= 100 ? 'success' : 'neutral'}
        />
        <Stat
          rotulo="Perdas por refugo"
          valor={dados ? percentual(dados.producao.percentual_perdas) : '—'}
          detalhe={dados ? `${numero(dados.producao.total_refugo)} peças refugadas` : 'Sem dados'}
          icone="alert"
          tom={dados && dados.producao.percentual_perdas > 5 ? 'warning' : 'neutral'}
        />
        <Stat
          rotulo="Entregas concluídas"
          valor={
            dados && dados.entregas.total > 0
              ? `${numero(dados.entregas.entregues)}/${numero(dados.entregas.total)}`
              : '—'
          }
          detalhe={
            !dados
              ? 'Sem dados'
              : dados.entregas.total > 0
                ? `${numero(dados.entregas.pendentes)} em andamento`
                : 'Nenhuma entrega no período'
          }
          icone="truck"
          tom={dados && dados.entregas.pendentes > 0 ? 'info' : 'neutral'}
        />
      </div>

      {indisponivel && (
        <Callout tom="warning" titulo="Indicadores indisponíveis offline">
          O painel precisa de conexão com o servidor. Os atalhos e lançamentos continuam
          funcionando.
        </Callout>
      )}

      <section className="home-section">
        <div className="section-head">
          <h2>Atalhos</h2>
          <p>Acesso rápido às rotinas do seu perfil.</p>
        </div>
        <div className="tile-grid">
          {atalhos.map((atalho) => (
            <Link
              key={atalho.para}
              className={`tile ${atalho.tipo === 'brand' ? 'tile--brand' : ''}`}
              to={atalho.para}
            >
              <span className="tile-icon">
                <Icon name={atalho.icone} size={20} />
              </span>
              <span className="tile-text">
                <strong>{atalho.titulo}</strong>
                <span>{atalho.descricao}</span>
              </span>
              {atalho.contador > 0 && <span className="tile-badge">{atalho.contador}</span>}
              <Icon name="arrow-right" size={17} className="tile-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {dados && dados.por_motivo.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2>Principais motivos de refugo</h2>
            <p>Últimos sete dias, apenas produção validada.</p>
          </div>
          <div className="card card--pad">
            <BarList dados={dados.por_motivo.slice(0, 5)} labelKey="nome" valueKey="total" />
          </div>
        </section>
      )}
    </div>
  )
}
