import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { BrandMark } from '../components/Brand'
import Icon from '../components/Icon'
import { Callout, Field, Spinner } from '../components/Ui'

const CONTAS_DEMO = [
  { login: 'admin', rotulo: 'Admin' },
  { login: 'gestor', rotulo: 'Gestor' },
  { login: 'supervisor', rotulo: 'Supervisor' },
  { login: 'operador', rotulo: 'Operador' },
  { login: 'conferente', rotulo: 'Conferente' },
  { login: 'motorista', rotulo: 'Motorista' }
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loginNome, setLoginNome] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await login(loginNome, senha)
      navigate('/', { replace: true })
    } catch (falha) {
      setErro(
        falha.code === 'NETWORK'
          ? 'Sem conexão com o servidor. Verifique sua rede e tente novamente.'
          : falha.message || 'Não foi possível entrar.'
      )
    } finally {
      setEnviando(false)
    }
  }

  function usarConta(conta) {
    setLoginNome(conta.login)
    setSenha('123456')
    setErro('')
  }

  return (
    <AuthLayout
      eyebrow="Plataforma industrial · cerâmica vermelha"
      titulo="Produção e expedição sob controle, mesmo sem internet."
      descricao="Apontamento de turnos, controle de refugo, expedição por lote e rastreio de cargas em um único fluxo — do forno à obra."
    >
      <form className="login-card" onSubmit={aoEnviar}>
        <header className="login-card-head">
          <div className="login-mobile-brand">
            <BrandMark size={34} />
            <span>Ceramix</span>
          </div>
          <p className="page-eyebrow">Acesso restrito</p>
          <h2>Entrar na plataforma</h2>
          <p>Informe apenas seu usuário e senha.</p>
        </header>

        {erro && (
          <Callout tom="danger" titulo="Não foi possível entrar">
            {erro}
          </Callout>
        )}

        <Field label="Usuário" htmlFor="login">
          <input
            id="login"
            className="input"
            value={loginNome}
            onChange={(evento) => setLoginNome(evento.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="seu.usuario"
            required
          />
        </Field>

        <Field label="Senha" htmlFor="senha">
          <div className="input-group">
            <input
              id="senha"
              className="input"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setMostrarSenha((valor) => !valor)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={mostrarSenha}
            >
              <Icon name={mostrarSenha ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
        </Field>

        <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner size={18} />
              Entrando…
            </>
          ) : (
            <>
              Entrar
              <Icon name="arrow-right" size={18} />
            </>
          )}
        </button>

        <p className="login-switch">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>

        <div className="login-demo">
          <p className="login-demo-title">Contas de demonstração</p>
          <div className="demo-chips">
            {CONTAS_DEMO.map((conta) => (
              <button
                key={conta.login}
                type="button"
                className="demo-chip"
                onClick={() => usarConta(conta)}
              >
                {conta.rotulo}
              </button>
            ))}
          </div>
          <p className="field-hint">Senha padrão das contas demo: 123456</p>
        </div>
      </form>

      <p className="login-foot">
        <Icon name="shield" size={14} />
        Sessão protegida por tokens de curta duração
      </p>
    </AuthLayout>
  )
}
