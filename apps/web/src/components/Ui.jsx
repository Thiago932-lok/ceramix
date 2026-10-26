import Icon from './Icon'
import { cn, numero, percentual, rotuloStatus, tomStatus } from '../lib/format'

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
}

export function PageHeader({ titulo, descricao, acoes, eyebrow }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{titulo}</h1>
        {descricao && <p className="page-sub">{descricao}</p>}
      </div>
      {acoes && <div className="page-actions">{acoes}</div>}
    </header>
  )
}

export function Badge({ status, children, tom }) {
  const classe = tom || (status ? tomStatus(status) : 'neutral')
  return <span className={`tag tag--${classe}`}>{children || rotuloStatus(status)}</span>
}

export function Card({ titulo, descricao, acoes, children, className, icone }) {
  return (
    <section className={cn('card', className)}>
      {(titulo || acoes) && (
        <header className="card-head">
          <div className="card-head-text">
            {titulo && (
              <h2 className="card-title">
                {icone && <Icon name={icone} size={18} />}
                {titulo}
              </h2>
            )}
            {descricao && <p className="card-sub">{descricao}</p>}
          </div>
          {acoes && <div className="card-actions">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({ label, htmlFor, hint, error, children, className }) {
  return (
    <div className={cn('field', className)}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function EmptyState({ icone = 'list', titulo, texto, acao }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icone} size={22} />
      </span>
      <h3 className="empty-title">{titulo}</h3>
      {texto && <p className="empty-text">{texto}</p>}
      {acao}
    </div>
  )
}

export function Skeleton({ linhas = 3 }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, indice) => (
        <span key={indice} className={`skeleton skeleton--${(indice % 3) + 1}`} />
      ))}
    </div>
  )
}

export function LoadingCards({ quantidade = 3 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando dados">
      {Array.from({ length: quantidade }).map((_, indice) => (
        <div className="card skeleton-card" key={indice}>
          <Skeleton linhas={3} />
        </div>
      ))}
    </div>
  )
}

export function Stat({ rotulo, valor, detalhe, icone, tom = 'neutral' }) {
  return (
    <article className={`stat stat--${tom}`}>
      <div className="stat-top">
        <span className="stat-label">{rotulo}</span>
        {icone && (
          <span className="stat-icon">
            <Icon name={icone} size={17} />
          </span>
        )}
      </div>
      <strong className="stat-value">{valor}</strong>
      {detalhe && <p className="stat-foot">{detalhe}</p>}
    </article>
  )
}

export function Callout({ tom = 'info', titulo, children, icone }) {
  const icones = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' }
  return (
    <div className={`callout callout--${tom}`} role={tom === 'danger' ? 'alert' : 'status'}>
      <Icon name={icone || icones[tom] || 'info'} size={18} />
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children && <div className="callout-text">{children}</div>}
      </div>
    </div>
  )
}

export function Progress({ valor = 0, max = 100, tom = 'brand' }) {
  const pct = max > 0 ? Math.min(100, Math.round((Number(valor) / Number(max)) * 100)) : 0
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={`progress-fill progress-fill--${tom}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function BarList({ dados, labelKey, valueKey, formatador = numero, vazio, sufixo }) {
  const lista = (dados || []).filter((item) => Number(item[valueKey]) > 0)
  if (lista.length === 0) {
    return <p className="muted">{vazio || 'Sem dados no período.'}</p>
  }
  const max = Math.max(...lista.map((item) => Number(item[valueKey]) || 0), 1)

  return (
    <div className="bar-list">
      {lista.map((item) => {
        const valor = Number(item[valueKey]) || 0
        return (
          <div className="bar-row" key={item[labelKey]}>
            <span className="bar-label" title={item[labelKey]}>
              {item[labelKey]}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(valor / max) * 100}%` }} />
            </span>
            <span className="bar-value">
              {formatador(valor)}
              {sufixo || ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Stepper({ passos, atual }) {
  return (
    <ol className="stepper" aria-label="Etapas do formulário">
      {passos.map((passo, indice) => {
        const estado = indice === atual ? 'active' : indice < atual ? 'done' : 'todo'
        return (
          <li
            key={passo}
            className={`step step--${estado}`}
            aria-current={indice === atual ? 'step' : undefined}
          >
            <span className="step-index">
              {indice < atual ? <Icon name="check" size={14} strokeWidth={2.4} /> : indice + 1}
            </span>
            <span className="step-label">{passo}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function SummaryRow({ rotulo, valor, destaque }) {
  return (
    <div className={`summary-row ${destaque ? 'summary-row--destaque' : ''}`}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  )
}

export function MetaBar({ valor, meta, label }) {
  const pct = meta > 0 ? Math.min(100, Math.round((Number(valor) / Number(meta)) * 100)) : 0
  return (
    <div className="meta-bar">
      <div className="meta-bar-top">
        <span>{label || 'Atingimento da meta'}</span>
        <strong>{percentual(pct)}</strong>
      </div>
      <Progress
        valor={valor}
        max={meta}
        tom={pct >= 100 ? 'success' : pct >= 70 ? 'brand' : 'warning'}
      />
      <p className="meta-bar-foot">
        {numero(valor)} de {numero(meta)} peças boas
      </p>
    </div>
  )
}
