import { api } from './api'
import { enfileirar } from './db'

const ENDPOINT = { producao: '/producoes', entrega: '/entregas' }

export async function salvarRegistro({ tipo, payload, online, atualizarContagem, sincronizar }) {
  async function paraFila() {
    await enfileirar({ id: payload.id, tipo, dados: payload })
    await atualizarContagem?.()
    return { destino: 'fila' }
  }

  if (!online) return paraFila()

  try {
    await api(ENDPOINT[tipo], { method: 'POST', body: payload })
    sincronizar?.()
    return { destino: 'servidor' }
  } catch (erro) {
    if (erro.code === 'NETWORK') return paraFila()
    throw erro
  }
}
