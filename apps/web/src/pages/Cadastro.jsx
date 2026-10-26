import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AuthLayout from '../components/AuthLayout'
import { BrandMark } from '../components/Brand'
import Icon from '../components/Icon'
import { Callout, Field, Spinner } from '../components/Ui'

const CARGOS = [
  {
    valor: 'admin',
    rotulo: 'Administrador',
    descricao: 'Configura a conta, os cadastros e os demais usuários.'
  },
  {
    valor: 'gestor',
    rotulo: 'Gestor',
    descricao: 'Gerencia produção, cadastros e indicadores da operação.'
  },
  {
    valor: 'supervisor',
    rotulo: 'Supervisor',
    descricao: 'Valida produções e acompanha a auditoria.'
  },
  {
    valor: 'operador',
    rotulo: 'Operador',
    descricao: 'Registra a produção dos turnos.'
  },
  {
    valor: 'conferente',
    rotulo: 'Conferente',
    descricao: 'Organiza a expedição e as entregas.'
  },
  {
    valor: 'motorista',
    rotulo: 'Motorista',
    descricao: 'Registra a saída e a chegada das cargas.'
  }
]

const FORM_INICIAL = {
  nome: '',
  empresa: '',
  cnpj: '',
  cargo: 'admin',
  login: '',
  senha: '',
  confirmar: ''
}

function primeiraMensagem(falha) {
  const detalhes = falha.data?.detalhes
  if (detalhes && typeof detalhes === 'object') {
    const mensagens = Object.values(detalhes).flat()
    if (mensagens.length > 0) return mensagens[0]
  }
  return falha.message || 'Não foi possível criar a conta.'
}

export default function Cadastro() {
  const { registrar } = useAuth()
  const { info } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(FORM_INICIAL)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargoAtual = CARGOS.find((cargo) => cargo.valor === form.cargo)

  function atualizar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')

    if (form.senha !== form.confirmar) {
      setErro('As senhas não conferem. Digite a mesma senha nos dois campos.')
      return
    }

    setEnviando(true)
    try {
      const usuario = await registrar({
        nome: form.nome.trim(),
        empresa: form.empresa.trim(),
        cnpj: form.cnpj.trim(),
        cargo: form.cargo,
        login: form.login.trim(),
        senha: form.senha
      })
      info(`Conta de ${usuario.empresaNome} criada. Bem-vindo!`)
      navigate('/', { replace: true })
    } catch (falha) {
      setErro(
        falha.code === 'NETWORK'
          ? 'Sem conexão com o servidor. Verifique sua rede e tente novamente.'
          : primeiraMensagem(falha)
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Comece agora"
      titulo="Sua cerâmica organizada do forno à obra."
      descricao="Crie a conta da sua empresa e comece com produtos, turnos, clientes, obras e veículos já configurados."
      className="login-main--form"
    >
      <form className="login-card login-card--wide" onSubmit={aoEnviar}>
        <header className="login-card-head">
          <div className="login-mobile-brand">
            <BrandMark size={34} />
            <span>Ceramix</span>
          </div>
          <p className="page-eyebrow">Nova conta</p>
          <h2>Criar conta da empresa</h2>
          <p>O cadastro cria uma nova empresa e o primeiro usuário com o cargo escolhido.</p>
        </header>

        {erro && (
          <Callout tom="danger" titulo="Não foi possível criar a conta">
            {erro}
          </Callout>
        )}

        <Callout tom="info" titulo="O cargo define suas permissões">
          Escolha Administrador para configurar a conta e criar os demais usuários. No login, você
          informa apenas usuário e senha.
        </Callout>

        <Field label="Seu nome" htmlFor="nome">
          <input
            id="nome"
            className="input"
            value={form.nome}
            onChange={(evento) => atualizar('nome', evento.target.value)}
            autoComplete="name"
            placeholder="Maria da Silva"
            minLength={2}
            maxLength={120}
            required
          />
        </Field>

        <div className="field-grid">
          <Field label="Empresa" htmlFor="empresa">
            <input
              id="empresa"
              className="input"
              value={form.empresa}
              onChange={(evento) => atualizar('empresa', evento.target.value)}
              autoComplete="organization"
              placeholder="Cerâmica da Silva"
              minLength={2}
              maxLength={120}
              required
            />
          </Field>

          <Field label="CNPJ (opcional)" htmlFor="cnpj">
            <input
              id="cnpj"
              className="input"
              value={form.cnpj}
              onChange={(evento) => atualizar('cnpj', evento.target.value)}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              maxLength={20}
            />
          </Field>
        </div>

        <Field
          label="Cargo"
          htmlFor="cargo"
          hint={
            cargoAtual
              ? `${cargoAtual.descricao} Você poderá criar outros usuários depois, se o cargo permitir.`
              : undefined
          }
        >
          <select
            id="cargo"
            className="select"
            value={form.cargo}
            onChange={(evento) => atualizar('cargo', evento.target.value)}
            required
          >
            {CARGOS.map((cargo) => (
              <option key={cargo.valor} value={cargo.valor}>
                {cargo.rotulo}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Usuário de acesso"
          htmlFor="login"
          hint="De 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado."
        >
          <input
            id="login"
            className="input"
            value={form.login}
            onChange={(evento) => atualizar('login', evento.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="maria.silva"
            pattern="[A-Za-z0-9._-]{3,40}"
            minLength={3}
            maxLength={40}
            required
          />
        </Field>

        <div className="field-grid">
          <Field label="Senha" htmlFor="senha" hint="Mínimo de 8 caracteres.">
            <div className="input-group">
              <input
                id="senha"
                className="input"
                type={mostrarSenha ? 'text' : 'password'}
                value={form.senha}
                onChange={(evento) => atualizar('senha', evento.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={8}
                maxLength={72}
                required
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setMostrarSenha((valor) => !valor)}
                aria-label={mostrarSenha ? 'Ocultar senhas' : 'Mostrar senhas'}
                aria-pressed={mostrarSenha}
              >
                <Icon name={mostrarSenha ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          </Field>

          <Field label="Confirmar senha" htmlFor="confirmar">
            <input
              id="confirmar"
              className="input"
              type={mostrarSenha ? 'text' : 'password'}
              value={form.confirmar}
              onChange={(evento) => atualizar('confirmar', evento.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              maxLength={72}
              required
            />
          </Field>
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner size={18} />
              Criando conta…
            </>
          ) : (
            <>
              Criar conta e entrar
              <Icon name="arrow-right" size={18} />
            </>
          )}
        </button>

        <p className="login-switch">
          Já tem uma conta? <Link to="/login">Entrar</Link>
        </p>
      </form>

      <p className="login-foot">
        <Icon name="building" size={14} />
        Cada conta acessa apenas os dados da própria empresa
      </p>
    </AuthLayout>
  )
}
