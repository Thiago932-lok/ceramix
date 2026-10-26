import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useToast } from '../context/ToastContext'
import { rotuloPerfil, iniciais, hora } from '../lib/format'
import {
  PERFIS_CADASTRO,
  PERFIS_ENTREGA,
  PERFIS_GESTAO,
  PERFIS_PRODUCAO,
  pertence
} from '../lib/acessos'
import Icon from './Icon'
import { BrandLockup, BrandMark } from './Brand'

const GRUPOS = [
  {
    titulo: 'Operação',
    itens: [
      { to: '/', rotulo: 'Início', icone: 'home', fim: true, perfis: null },
      {
        to: '/producao/nova',
        rotulo: 'Nova produção',
        icone: 'plus',
        perfis: PERFIS_PRODUCAO
      },
      { to: '/producoes', rotulo: 'Produções', icone: 'factory', perfis: PERFIS_PRODUCAO },
      { to: '/entrega/nova', rotulo: 'Nova entrega', icone: 'truck', perfis: PERFIS_ENTREGA },
      { to: '/entregas', rotulo: 'Entregas', icone: 'package', perfis: PERFIS_ENTREGA }
    ]
  },
  {
    titulo: 'Gestão',
    itens: [
      { to: '/dashboard', rotulo: 'Painel', icone: 'chart', perfis: null },
      { to: '/pendentes', rotulo: 'Fila offline', icone: 'layers', perfis: null, contador: true },
      { to: '/auditoria', rotulo: 'Auditoria', icone: 'shield', perfis: PERFIS_GESTAO },
      { to: '/cadastros', rotulo: 'Cadastros', icone: 'settings', perfis: PERFIS_CADASTRO }
    ]
  }
]

function tituloDaRota(pathname) {
  const mapa = {
    '/': 'Início',
    '/producao/nova': 'Nova produção',
    '/producoes': 'Produções',
    '/entrega/nova': 'Nova entrega',
    '/entregas': 'Entregas',
    '/dashboard': 'Painel',
    '/pendentes': 'Fila offline',
    '/auditoria': 'Auditoria',
    '/cadastros': 'Cadastros'
  }
  return mapa[pathname] || 'Ceramix'
}

export default function Layout() {
  const { usuario, logout } = useAuth()
  const { sincronizar, sincronizando, online, pendentes, ultimaSync } = useSync()
  const { info } = useToast()
  const navigate = useNavigate()
  const local = useLocation()

  useEffect(() => {
    document.title = `${tituloDaRota(local.pathname)} · Ceramix`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [local.pathname])

  const perfil = usuario.perfil
  const itensMobile = [
    { to: '/', rotulo: 'Início', icone: 'home', fim: true },
    pertence(perfil, PERFIS_PRODUCAO) && {
      to: '/producao/nova',
      rotulo: 'Produção',
      icone: 'plus',
      ativoEm: ['/producao/nova', '/producoes']
    },
    pertence(perfil, PERFIS_ENTREGA) && {
      to: '/entrega/nova',
      rotulo: 'Entrega',
      icone: 'truck',
      ativoEm: ['/entrega/nova', '/entregas']
    },
    { to: '/dashboard', rotulo: 'Painel', icone: 'chart' },
    { to: '/pendentes', rotulo: 'Fila', icone: 'layers', contador: true }
  ].filter(Boolean)

  async function sair() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function sincronizarAgora() {
    if (sincronizando) return
    await sincronizar()
    if (online) info('Sincronização concluída.')
  }

  const statusSync = sincronizando
    ? 'Sincronizando…'
    : !online
      ? 'Modo offline'
      : pendentes > 0
        ? `${pendentes} na fila`
        : 'Tudo sincronizado'

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLockup />
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {GRUPOS.map((grupo) => {
            const itens = grupo.itens.filter((item) => pertence(perfil, item.perfis))
            if (itens.length === 0) return null
            return (
              <div className="nav-group" key={grupo.titulo}>
                <p className="nav-group-title">{grupo.titulo}</p>
                {itens.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.fim}
                    className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon name={item.icone} size={18} />
                    <span>{item.rotulo}</span>
                    {item.contador && pendentes > 0 && (
                      <span className="nav-count">{pendentes}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sync-card ${online ? 'is-online' : 'is-offline'}`}
            onClick={sincronizarAgora}
            disabled={sincronizando}
          >
            <span className="sync-dot" />
            <span className="sync-card-text">
              <strong>{statusSync}</strong>
              <small>
                {ultimaSync ? `Última sincronização ${hora(ultimaSync)}` : 'Ainda não sincronizado'}
              </small>
            </span>
            <Icon
              name={sincronizando ? 'refresh' : online ? 'wifi' : 'wifi-off'}
              size={16}
              className={sincronizando ? 'spin' : ''}
            />
          </button>

          <div className="user-card">
            <span className="avatar" aria-hidden="true">
              {iniciais(usuario.nome)}
            </span>
            <div className="user-meta" title={usuario.empresaNome}>
              <strong>{usuario.nome}</strong>
              <span>{rotuloPerfil(perfil)}</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={sair}
              aria-label="Sair da conta"
              title="Sair"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-brand">
            <BrandMark />
            <span>Ceramix</span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className={`sync-pill ${online ? 'is-online' : 'is-offline'}`}
              onClick={sincronizarAgora}
              disabled={sincronizando}
              aria-label={`${statusSync}. Toque para sincronizar.`}
            >
              <span className="sync-dot" />
              <span>{statusSync}</span>
            </button>
            <button type="button" className="icon-btn" onClick={sair} aria-label="Sair da conta">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main id="conteudo" className="app-main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegação rápida">
        {itensMobile.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fim}
            className={({ isActive }) => {
              const ativoExtra = item.ativoEm?.includes(local.pathname)
              return `bnav-item ${isActive || ativoExtra ? 'is-active' : ''}`
            }}
          >
            <span className="bnav-icon">
              <Icon name={item.icone} size={21} />
              {item.contador && pendentes > 0 && <span className="bnav-badge">{pendentes}</span>}
            </span>
            <span>{item.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
