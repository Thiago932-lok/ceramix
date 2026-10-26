import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialogo, setDialogo] = useState(null)
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const resolver = useRef(null)
  const inputRef = useRef(null)

  const fechar = useCallback((resultado) => {
    if (resolver.current) resolver.current(resultado)
    resolver.current = null
    setDialogo(null)
    setValor('')
    setErro('')
  }, [])

  function abrir(config) {
    setDialogo(config)
    setValor(config.valorInicial || '')
    setErro('')
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }

  function confirmar(opcoes) {
    return abrir({ modo: 'confirmar', ...opcoes })
  }

  function pedirTexto(opcoes) {
    return abrir({ modo: 'texto', ...opcoes })
  }

  useEffect(() => {
    if (!dialogo) return undefined
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const temporizador = window.setTimeout(() => {
      if (dialogo.modo === 'texto') inputRef.current?.focus()
    }, 30)

    function onKeyDown(evento) {
      if (evento.key === 'Escape') fechar(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = anterior
      window.clearTimeout(temporizador)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dialogo, fechar])

  function aoConfirmar() {
    if (dialogo.modo === 'texto') {
      const texto = valor.trim()
      const minimo = dialogo.minimo ?? 3
      if (dialogo.obrigatorio !== false && texto.length < minimo) {
        setErro(`Informe ao menos ${minimo} caracteres.`)
        return
      }
      fechar(texto)
      return
    }
    fechar(true)
  }

  return (
    <DialogContext.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {dialogo && (
        <div
          className="modal-backdrop"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) fechar(null)
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-titulo"
            aria-describedby={dialogo.mensagem ? 'modal-mensagem' : undefined}
          >
            <header className="modal-head">
              <span className={`modal-icon ${dialogo.perigo ? 'is-danger' : ''}`}>
                <Icon name={dialogo.icone || (dialogo.perigo ? 'alert' : 'info')} size={20} />
              </span>
              <h2 id="modal-titulo" className="modal-title">
                {dialogo.titulo || 'Confirmar ação'}
              </h2>
            </header>

            {dialogo.mensagem && (
              <p id="modal-mensagem" className="modal-message">
                {dialogo.mensagem}
              </p>
            )}

            {dialogo.modo === 'texto' && (
              <div className="field">
                <label className="field-label" htmlFor="modal-texto">
                  {dialogo.rotulo || 'Observação'}
                </label>
                <textarea
                  id="modal-texto"
                  ref={inputRef}
                  className="textarea"
                  rows={3}
                  maxLength={dialogo.maxLength || 300}
                  value={valor}
                  placeholder={dialogo.placeholder}
                  onChange={(evento) => {
                    setValor(evento.target.value)
                    setErro('')
                  }}
                />
                {erro && <p className="field-error">{erro}</p>}
              </div>
            )}

            <footer className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => fechar(null)}>
                {dialogo.textoCancelar || 'Cancelar'}
              </button>
              <button
                type="button"
                className={`btn ${dialogo.perigo ? 'btn-danger' : 'btn-primary'}`}
                onClick={aoConfirmar}
              >
                {dialogo.textoConfirmar || 'Confirmar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialogs() {
  const contexto = useContext(DialogContext)
  if (!contexto) throw new Error('useDialogs deve ser usado dentro de DialogProvider')
  return contexto
}
