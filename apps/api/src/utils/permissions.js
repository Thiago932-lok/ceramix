export const PERFIS = ['admin', 'gestor', 'supervisor', 'operador', 'conferente', 'motorista']

const matriz = {
  'producao.criar': ['admin', 'gestor', 'supervisor', 'operador'],
  'producao.validar': ['admin', 'gestor', 'supervisor'],
  'producao.cancelar': ['admin', 'gestor', 'supervisor'],
  'producao.listar': ['admin', 'gestor', 'supervisor', 'operador'],
  'entrega.criar': ['admin', 'gestor', 'supervisor', 'conferente', 'motorista'],
  'entrega.confirmar': ['admin', 'gestor', 'supervisor', 'conferente', 'motorista'],
  'entrega.cancelar': ['admin', 'gestor', 'supervisor'],
  'entrega.listar': ['admin', 'gestor', 'supervisor', 'conferente', 'motorista'],
  'dashboard.ver': ['admin', 'gestor', 'supervisor', 'operador', 'conferente', 'motorista'],
  'cadastros.gerir': ['admin', 'gestor'],
  'usuarios.gerir': ['admin'],
  'auditoria.ver': ['admin', 'gestor', 'supervisor'],
  'dispositivos.revogar': ['admin'],
  'sync.enviar': ['admin', 'gestor', 'supervisor', 'operador', 'conferente', 'motorista']
}

export function pode(perfil, acao) {
  return (matriz[acao] || []).includes(perfil)
}

export function requirePerm(acao) {
  return (req, res, next) => {
    if (!req.user || !pode(req.user.perfil, acao)) {
      return res.status(403).json({ erro: 'Sem permissao para esta acao' })
    }
    next()
  }
}
