import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('Erro não tratado na interface', erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="fatal">
          <div className="fatal-card">
            <p className="page-eyebrow">Erro inesperado</p>
            <h1>Não foi possível exibir esta tela</h1>
            <p>
              Seus registros continuam salvos no aparelho. Recarregue a página para tentar
              novamente.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Recarregar aplicativo
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
