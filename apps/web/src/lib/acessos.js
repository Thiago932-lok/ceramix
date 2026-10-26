export const PERFIS_PRODUCAO = ['admin', 'gestor', 'supervisor', 'operador']
export const PERFIS_ENTREGA = ['admin', 'gestor', 'supervisor', 'conferente', 'motorista']
export const PERFIS_GESTAO = ['admin', 'gestor', 'supervisor']
export const PERFIS_CADASTRO = ['admin', 'gestor']
export const PERFIS_ADMIN = ['admin']

export function pertence(perfil, perfis) {
  return !perfis || perfis.includes(perfil)
}
