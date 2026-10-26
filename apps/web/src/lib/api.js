const API = '/api'

let accessToken = null
let refreshToken = null
let refreshEmAndamento = null

export class ApiError extends Error {
  constructor(mensagem, { status = 0, data = null, code = null } = {}) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code = code
  }
}

export function setTokens(access, refresh) {
  accessToken = access || null
  refreshToken = refresh || null
  if (access) sessionStorage.setItem('cx_access', access)
  else sessionStorage.removeItem('cx_access')
  if (refresh) sessionStorage.setItem('cx_refresh', refresh)
  else sessionStorage.removeItem('cx_refresh')
}

export function loadTokens() {
  accessToken = accessToken || sessionStorage.getItem('cx_access')
  refreshToken = refreshToken || sessionStorage.getItem('cx_refresh')
  return { accessToken, refreshToken }
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  sessionStorage.removeItem('cx_access')
  sessionStorage.removeItem('cx_refresh')
}

export function temSessao() {
  loadTokens()
  return Boolean(accessToken || refreshToken)
}

async function enviar(path, options, token) {
  const headers = new Headers(options.headers || {})
  const corpo = options.body
  const ehFormData = corpo instanceof FormData

  if (corpo !== undefined && !ehFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: corpo && typeof corpo === 'object' && !ehFormData ? JSON.stringify(corpo) : corpo
    })
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    throw new ApiError('Sem conexão com o servidor', { code: 'NETWORK' })
  }

  const texto = await res.text()
  let data = null
  try {
    data = texto ? JSON.parse(texto) : null
  } catch {
    data = texto
  }
  return { res, data }
}

async function executarRefresh() {
  if (!refreshToken) loadTokens()
  if (!refreshToken) {
    throw new ApiError('Sessão expirada', { status: 401, code: 'SESSION' })
  }

  const { res, data } = await enviar('/auth/refresh', {
    method: 'POST',
    body: { refreshToken }
  })

  if (!res.ok || !data?.accessToken) {
    clearTokens()
    throw new ApiError('Sessão expirada', { status: 401, code: 'SESSION' })
  }

  setTokens(data.accessToken, data.refreshToken)
  return data.accessToken
}

function renovarSessao() {
  if (!refreshEmAndamento) {
    refreshEmAndamento = executarRefresh().finally(() => {
      refreshEmAndamento = null
    })
  }
  return refreshEmAndamento
}

export async function api(path, options = {}) {
  loadTokens()

  let { res, data } = await enviar(path, options, accessToken)
  const podeRenovar = !['/auth/login', '/auth/registrar', '/auth/refresh', '/auth/logout'].includes(
    path
  )

  if (res.status === 401 && refreshToken && podeRenovar) {
    try {
      const novoToken = await renovarSessao()
      ;({ res, data } = await enviar(path, options, novoToken))
    } catch (erro) {
      if (erro.code === 'NETWORK') throw erro
      throw new ApiError('Sessão expirada. Entre novamente.', { status: 401, code: 'SESSION' })
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.erro || 'Falha na requisição', { status: res.status, data })
  }
  return data
}
