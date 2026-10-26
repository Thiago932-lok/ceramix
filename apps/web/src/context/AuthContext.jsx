import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearTokens, loadTokens, setTokens, temSessao } from '../lib/api'
import {
  db,
  getDispositivoId,
  limparSessaoLocal,
  pedirPersistencia,
  salvarReferencia
} from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function iniciar() {
      await pedirPersistencia()
      loadTokens()
      const local = await db.sessao.get('atual')
      if (local?.usuario) setUsuario(local.usuario)

      try {
        if (temSessao()) {
          const me = await api('/auth/me')
          setUsuario(me.usuario)
          await db.sessao.put({ id: 'atual', usuario: me.usuario, em: new Date().toISOString() })
        }
      } catch (erro) {
        if (erro.code === 'SESSION') {
          clearTokens()
          await limparSessaoLocal()
          setUsuario(null)
        } else if (!local?.usuario) {
          clearTokens()
          setUsuario(null)
        }
      } finally {
        setCarregando(false)
      }
    }
    iniciar()
  }, [])

  async function aplicarSessao(data) {
    setTokens(data.accessToken, data.refreshToken)
    setUsuario(data.usuario)
    await db.sessao.put({ id: 'atual', usuario: data.usuario, em: new Date().toISOString() })
    try {
      const referencia = await api('/catalogo/referencia')
      await salvarReferencia(referencia)
    } catch {
      // catálogo será buscado novamente na próxima sincronização
    }
    return data.usuario
  }

  async function login(loginNome, senha) {
    const dispositivoId = await getDispositivoId()
    const data = await api('/auth/login', {
      method: 'POST',
      body: {
        login: loginNome,
        senha,
        dispositivoId,
        dispositivoNome: 'Ceramix PWA'
      }
    })
    return aplicarSessao(data)
  }

  async function registrar(dados) {
    const dispositivoId = await getDispositivoId()
    const data = await api('/auth/registrar', {
      method: 'POST',
      body: { ...dados, dispositivoId, dispositivoNome: 'Ceramix PWA' }
    })
    return aplicarSessao(data)
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } catch {
      // mesmo sem servidor, a sessão local é encerrada
    }
    clearTokens()
    await limparSessaoLocal()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, registrar, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return contexto
}
