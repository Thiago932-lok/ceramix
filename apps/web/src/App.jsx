import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/Ui'

const Login = lazy(() => import('./pages/Login'))
const Cadastro = lazy(() => import('./pages/Cadastro'))
const Home = lazy(() => import('./pages/Home'))
const NovaProducao = lazy(() => import('./pages/NovaProducao'))
const Producoes = lazy(() => import('./pages/Producoes'))
const NovaEntrega = lazy(() => import('./pages/NovaEntrega'))
const Entregas = lazy(() => import('./pages/Entregas'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Cadastros = lazy(() => import('./pages/Cadastros'))
const Pendentes = lazy(() => import('./pages/Pendentes'))
const NaoEncontrada = lazy(() => import('./pages/NaoEncontrada'))

function TelaCarregando({ mensagem = 'Carregando…' }) {
  return (
    <div className="loading-screen">
      <Spinner size={26} />
      <p>{mensagem}</p>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  return children
}

function RoleGate({ perfis, children }) {
  const { usuario } = useAuth()
  if (!perfis.includes(usuario.perfil)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { usuario, carregando } = useAuth()

  if (carregando) {
    return <TelaCarregando mensagem="Preparando o Ceramix…" />
  }

  return (
    <Suspense fallback={<TelaCarregando />}>
      <Routes>
        <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/cadastro" element={usuario ? <Navigate to="/" replace /> : <Cadastro />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="producao/nova" element={<NovaProducao />} />
          <Route path="producoes" element={<Producoes />} />
          <Route path="entrega/nova" element={<NovaEntrega />} />
          <Route path="entregas" element={<Entregas />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pendentes" element={<Pendentes />} />
          <Route
            path="auditoria"
            element={
              <RoleGate perfis={['admin', 'gestor', 'supervisor']}>
                <Auditoria />
              </RoleGate>
            }
          />
          <Route
            path="cadastros"
            element={
              <RoleGate perfis={['admin', 'gestor']}>
                <Cadastros />
              </RoleGate>
            }
          />
          <Route path="*" element={<NaoEncontrada />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
