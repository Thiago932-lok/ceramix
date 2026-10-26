import { BrandMark } from './Brand'
import Icon from './Icon'

const DESTAQUES = [
  { icone: 'wifi-off', titulo: 'Operação offline-first', texto: 'Registre mesmo sem sinal.' },
  { icone: 'shield', titulo: 'Acesso por perfil', texto: 'Permissões validadas no servidor.' },
  { icone: 'file-text', titulo: 'Auditoria completa', texto: 'Cada ação fica rastreada.' },
  { icone: 'map-pin', titulo: 'Rastreio de cargas', texto: 'Saída e chegada com GPS.' }
]

export default function AuthLayout({ eyebrow, titulo, descricao, children, className = '' }) {
  return (
    <div className="login">
      <aside className="login-brand">
        <div className="login-brand-top">
          <BrandMark size={44} />
          <span className="login-wordmark">Ceramix</span>
        </div>

        <div className="login-pitch">
          <p className="login-eyebrow">{eyebrow}</p>
          <h1>{titulo}</h1>
          <p>{descricao}</p>
        </div>

        <ul className="login-features">
          {DESTAQUES.map((item) => (
            <li key={item.titulo}>
              <span className="login-feature-icon">
                <Icon name={item.icone} size={18} />
              </span>
              <div>
                <strong>{item.titulo}</strong>
                <span>{item.texto}</span>
              </div>
            </li>
          ))}
        </ul>

        <footer className="login-brand-foot">Cerâmica Integra · INTEGRA SENAI 2026</footer>
      </aside>

      <main className={`login-main ${className}`.trim()}>{children}</main>
    </div>
  )
}
