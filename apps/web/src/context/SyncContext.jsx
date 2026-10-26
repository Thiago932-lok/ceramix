import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  CATALOGO_VAZIO,
  atualizarOutbox,
  contarPendentes,
  listarPendentes,
  obterMeta,
  obterReferencia,
  removerOutbox,
  salvarMeta,
  salvarReferencia
} from '../lib/db'
import { useAuth } from './AuthContext'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { usuario } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSync, setUltimaSync] = useState(null)
  const [mensagem, setMensagem] = useState('')
  const emAndamento = useRef(false)

  const atualizarContagem = useCallback(async () => {
    setPendentes(await contarPendentes())
  }, [])

  const sincronizar = useCallback(async () => {
    if (!usuario || emAndamento.current || !navigator.onLine) return
    emAndamento.current = true
    setSincronizando(true)
    setMensagem('')

    try {
      const referencia = await api('/catalogo/referencia')
      await salvarReferencia(referencia)

      const fila = await listarPendentes()
      const paraEnvio = fila.filter((item) => item.status === 'PENDENTE')

      if (paraEnvio.length > 0) {
        const resposta = await api('/sync/batch', {
          method: 'POST',
          body: {
            itens: paraEnvio.map((item) => ({
              id: item.id,
              tipo: item.tipo,
              dados: item.dados
            }))
          }
        })

        for (const resultado of resposta.resultados || []) {
          if (resultado.status === 'ACEITO' || resultado.status === 'JA_RECEBIDO') {
            await removerOutbox(resultado.id)
          } else {
            await atualizarOutbox(resultado.id, {
              status: 'REJEITADO',
              erro: resultado.erro || 'Registro rejeitado pelo servidor'
            })
          }
        }
      }

      const agora = new Date().toISOString()
      setUltimaSync(agora)
      await salvarMeta('ultima_sync', agora)
      setMensagem('Sincronizado com o servidor')
    } catch (erro) {
      setMensagem(erro.message || 'Falha na sincronização')
    } finally {
      await atualizarContagem()
      setSincronizando(false)
      emAndamento.current = false
    }
  }, [usuario, atualizarContagem])

  useEffect(() => {
    atualizarContagem()
    obterMeta('ultima_sync').then((valor) => {
      if (valor) setUltimaSync(valor)
    })
  }, [atualizarContagem])

  useEffect(() => {
    function aoFicarOnline() {
      setOnline(true)
      sincronizar()
    }
    function aoFicarOffline() {
      setOnline(false)
    }
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    return () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [sincronizar])

  useEffect(() => {
    if (!usuario) return undefined
    sincronizar()
    const intervalo = window.setInterval(() => {
      if (navigator.onLine) sincronizar()
    }, 60_000)

    function aoVoltar() {
      if (document.visibilityState === 'visible' && navigator.onLine) sincronizar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [usuario, sincronizar])

  const getCatalogo = useCallback(async () => {
    const local = await obterReferencia()
    if (local) return local
    if (navigator.onLine && usuario) {
      try {
        const referencia = await api('/catalogo/referencia')
        await salvarReferencia(referencia)
        return referencia
      } catch {
        return CATALOGO_VAZIO
      }
    }
    return CATALOGO_VAZIO
  }, [usuario])

  return (
    <SyncContext.Provider
      value={{
        online,
        pendentes,
        sincronizando,
        ultimaSync,
        mensagem,
        sincronizar,
        atualizarContagem,
        getCatalogo
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const contexto = useContext(SyncContext)
  if (!contexto) throw new Error('useSync deve ser usado dentro de SyncProvider')
  return contexto
}
