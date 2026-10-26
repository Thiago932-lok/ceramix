const formatoNumero = new Intl.NumberFormat('pt-BR')
const formatoDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})
const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function numero(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—'
  return formatoNumero.format(Number(valor))
}

export function decimal(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  }).format(Number(valor))
}

export function moeda(valor) {
  if (valor === null || valor === undefined) return '—'
  return formatoMoeda.format(Number(valor))
}

export function percentual(valor) {
  if (valor === null || valor === undefined) return '—'
  return `${formatoDecimal.format(Number(valor))}%`
}

function parseData(iso) {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split('-').map(Number)
    return new Date(ano, mes - 1, dia)
  }
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? null : data
}

export function data(iso) {
  const d = parseData(iso)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function dataCurta(iso) {
  const d = parseData(iso)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function dataLonga(iso) {
  const d = parseData(iso) || new Date()
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function dataHora(iso) {
  const d = parseData(iso)
  if (!d) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function hora(iso) {
  const d = parseData(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function horas(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return `${formatoDecimal.format(Number(valor))} h`
}

export function paraISO(dataLocal) {
  const d = dataLocal instanceof Date ? dataLocal : parseData(dataLocal)
  if (!d) return ''
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function diasAtras(dias) {
  return paraISO(new Date(Date.now() - dias * 86_400_000))
}

export function hoje() {
  return paraISO(new Date())
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
}

export function saudacao(dataAtual = new Date()) {
  const h = dataAtual.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const ROTULOS_STATUS = {
  pendente_validacao: 'Aguardando validação',
  validado: 'Validada',
  rejeitado: 'Rejeitada',
  cancelado: 'Cancelada',
  saida_registrada: 'Saída registrada',
  em_transito: 'Em trânsito',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
  ACEITO: 'Aceito',
  JA_RECEBIDO: 'Já recebido',
  REJEITADO: 'Rejeitado',
  PENDENTE: 'Pendente'
}

export function rotuloStatus(status) {
  return ROTULOS_STATUS[status] || status || '—'
}

export function tomStatus(status) {
  if (['validado', 'entregue', 'ACEITO', 'JA_RECEBIDO'].includes(status)) return 'success'
  if (['cancelado', 'cancelada', 'REJEITADO'].includes(status)) return 'danger'
  if (['pendente_validacao', 'PENDENTE'].includes(status)) return 'warning'
  if (['saida_registrada', 'em_transito', 'rejeitado'].includes(status)) return 'info'
  return 'neutral'
}

const ROTULOS_PERFIL = {
  admin: 'Administrador',
  gestor: 'Gestor',
  supervisor: 'Supervisor',
  operador: 'Operador',
  conferente: 'Conferente',
  motorista: 'Motorista'
}

export function rotuloPerfil(perfil) {
  return ROTULOS_PERFIL[perfil] || perfil || '—'
}

export function rotuloTipo(tipo) {
  if (tipo === 'producao') return 'Produção'
  if (tipo === 'entrega') return 'Entrega'
  return tipo || '—'
}

export function rotuloEvento(tipo) {
  const mapa = {
    qr_saida: 'Saída registrada',
    qr_chegada: 'Chegada registrada',
    gps_saida: 'GPS da saída',
    gps_chegada: 'GPS da chegada',
    confirmacao: 'Confirmação da entrega'
  }
  return mapa[tipo] || tipo
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
