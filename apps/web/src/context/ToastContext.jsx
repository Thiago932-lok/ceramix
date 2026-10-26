import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'

const ToastContext = createContext(null)

const ICONES = { success: 'check', error: 'alert', info: 'info', warning: 'alert' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const contador = useRef(0)

  const remover = useCallback((id) => {
    setToasts((atuais) => atuais.filter((toast) => toast.id !== id))
  }, [])

  const notificar = useCallback(
    (mensagem, tipo = 'info', duracao = 4200) => {
      contador.current += 1
      const id = contador.current
      setToasts((atuais) => [...atuais.slice(-2), { id, mensagem, tipo }])
      window.setTimeout(() => remover(id), duracao)
      return id
    },
    [remover]
  )

  const valor = useMemo(
    () => ({
      notificar,
      sucesso: (mensagem) => notificar(mensagem, 'success'),
      erro: (mensagem) => notificar(mensagem, 'error', 6000),
      info: (mensagem) => notificar(mensagem, 'info')
    }),
    [notificar]
  )

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tipo}`} role="status">
            <span className="toast-icon">
              <Icon name={ICONES[toast.tipo] || 'info'} size={18} />
            </span>
            <p>{toast.mensagem}</p>
            <button
              type="button"
              className="toast-close"
              onClick={() => remover(toast.id)}
              aria-label="Fechar aviso"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const contexto = useContext(ToastContext)
  if (!contexto) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return contexto
}
