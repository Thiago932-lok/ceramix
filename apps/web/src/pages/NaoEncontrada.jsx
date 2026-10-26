import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function NaoEncontrada() {
  return (
    <div className="page">
      <div className="empty empty--page">
        <span className="empty-icon">
          <Icon name="search" size={24} />
        </span>
        <p className="page-eyebrow">Erro 404</p>
        <h1 className="empty-title">Página não encontrada</h1>
        <p className="empty-text">
          O endereço acessado não existe ou foi movido. Volte ao início para continuar.
        </p>
        <Link className="btn btn-primary" to="/">
          <Icon name="home" size={18} />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
