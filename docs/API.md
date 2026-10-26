# API

Referência dos contratos HTTP do Ceramix. A API é versionada junto com o app; não há prefixo de versão na URL.

- **Base local:** `http://localhost:3001/api`
- **Conteúdo:** JSON UTF-8 (exceto exportação CSV)
- **Autenticação:** `Authorization: Bearer <accessToken>` ou cookies `access_token` / `refresh_token`
- **Identificador de requisição:** toda resposta traz `x-request-id`, útil para correlação nos logs

## Autenticação e sessão

### `POST /auth/registrar`

Público. Cria uma nova empresa, o primeiro usuário com o cargo escolhido e um catálogo inicial, devolvendo a sessão já autenticada. Limite de 10 cadastros por hora por IP.

```json
{
  "nome": "Marina Costa",
  "empresa": "Cerâmica Costa",
  "cnpj": "11.222.333/0001-44",
  "login": "marina.costa",
  "senha": "senha-forte-123",
  "cargo": "gestor",
  "dispositivoId": "3f0e6f1c-8b26-4b1d-9c3a-6f7d2a5b8e41",
  "dispositivoNome": "Ceramix PWA"
}
```

Regras:

- `cargo` aceita `admin`, `gestor`, `supervisor`, `operador`, `conferente` ou `motorista` e é gravado como perfil de acesso (RBAC). O login não recebe cargo.
- `cnpj` é opcional; quando informado, precisa ter 14 dígitos (a formatação é removida).
- `login` é normalizado para minúsculas, aceita de 3 a 40 caracteres (`a-z`, `0-9`, `.`, `_`, `-`) e é único em toda a base.
- `senha` tem no mínimo 8 e no máximo 72 caracteres.
- O catálogo inicial contém três turnos, cinco motivos de refugo, um produto, um lote, um cliente, uma obra, um veículo e uma meta de 1.200 peças por dia.

**201** — mesmo formato do login, incluindo `empresaNome` no usuário. Também define os cookies de sessão.

Erros: `400` validação, `409` login já utilizado, `429` limite de cadastros.

### `POST /auth/login`

Público. Limite de 20 tentativas por 15 minutos por IP. Cinco falhas consecutivas bloqueiam a conta por 15 minutos.

```json
{
  "login": "operador",
  "senha": "123456",
  "dispositivoId": "3f0e6f1c-8b26-4b1d-9c3a-6f7d2a5b8e41",
  "dispositivoNome": "Galaxy A54 — Produção"
}
```

`dispositivoId` e `dispositivoNome` são opcionais. Se o ID não existir, o dispositivo é criado; se estiver revogado, o login falha com `401`.

**200**

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "dispositivoId": "3f0e6f1c-8b26-4b1d-9c3a-6f7d2a5b8e41",
  "usuario": {
    "id": "<uuid>",
    "nome": "João Operador",
    "login": "operador",
    "perfil": "operador",
    "empresaId": "<uuid>",
    "empresaNome": "Cerâmica Integra Ltda"
  }
}
```

Também define os cookies `access_token` e `refresh_token` (`httpOnly`, `SameSite=Lax`, `Secure` em produção).

Erros: `400` payload inválido, `401` credenciais inválidas/usuário desativado/dispositivo revogado, `423` conta bloqueada, `429` muitas tentativas.

### `POST /auth/refresh`

Público. Aceita `refreshToken` no corpo ou no cookie. Rotaciona o token: o usado é revogado e um novo par é devolvido.

```json
{ "refreshToken": "<jwt>" }
```

**200** `{ "accessToken": "...", "refreshToken": "..." }`

Erros: `401` token ausente, inválido, expirado, revogado ou de dispositivo revogado.

### `POST /auth/logout`

Autenticado. Revoga o refresh token informado (corpo ou cookie), limpa cookies e audita a saída.

**200** `{ "ok": true }`

### `GET /auth/me`

Autenticado. Devolve o usuário resolvido pelo token e o dispositivo atual.

```json
{
  "usuario": {
    "id": "<uuid>",
    "empresaId": "<uuid>",
    "empresaNome": "Cerâmica Integra Ltda",
    "nome": "João Operador",
    "login": "operador",
    "perfil": "operador"
  },
  "dispositivoId": "<uuid>"
}
```

## Catálogo e cadastros

### `GET /catalogo/referencia`

Autenticado. Devolve todo o catálogo ativo da empresa para cache local.

| Query           | Descrição                                               |
| --------------- | ------------------------------------------------------- |
| `updated_since` | Opcional, ISO 8601; retorna apenas registros mais novos |

**200**

```json
{
  "produtos": [],
  "turnos": [],
  "motivos_refugo": [],
  "lotes": [],
  "obras": [],
  "veiculos": [],
  "metas_producao": [],
  "clientes": [],
  "sincronizado_em": "2026-10-26T17:00:00.000Z"
}
```

### Produtos

- `GET /catalogo/produtos` — requer `cadastros.gerir`; lista todos, inclusive inativos.
- `POST /catalogo/produtos` — requer `cadastros.gerir`.

```json
{ "nome": "Tijolo 9 furos", "codigo": "TIJ-9F", "unidade": "un" }
```

**201** `{ "id": "<uuid>", "nome": "...", "codigo": "...", "unidade": "un" }` — `409` se o código já existir.

### Turnos, motivos, obras e veículos

| Método | Rota                       | Observação                          |
| ------ | -------------------------- | ----------------------------------- |
| GET    | `/catalogo/turnos`         | Somente ativos, ordenados por nome  |
| GET    | `/catalogo/motivos-refugo` | Somente ativos, ordenados por nome  |
| GET    | `/catalogo/obras`          | Somente ativas, ordenadas por nome  |
| GET    | `/catalogo/veiculos`       | Somente ativos, ordenados por placa |

### Lotes

- `GET /catalogo/lotes` — inclui `produto_nome` e o campo calculado `saldo` (`produzida − expedida`).
- `POST /catalogo/lotes` — requer `cadastros.gerir`.

```json
{ "codigo": "L0005-2026", "produto_id": "<uuid>", "quantidade_produzida": 0 }
```

**201** com o lote criado; `400` produto inválido; `409` código duplicado.

### Usuários

- `GET /catalogo/usuarios` — requer `usuarios.gerir`.
- `POST /catalogo/usuarios` — requer `usuarios.gerir`.

```json
{
  "nome": "Ana Analista",
  "login": "ana",
  "senha": "senha-forte",
  "perfil": "supervisor"
}
```

Perfis aceitos: `admin`, `gestor`, `supervisor`, `operador`, `conferente`, `motorista`. A senha tem mínimo de 6 caracteres. O login é único em toda a base; `409` se já existir.

### Dispositivos

- `GET /catalogo/dispositivos` — requer `dispositivos.revogar`; últimos 100 por acesso.
- `POST /catalogo/dispositivos/:id/revogar` — requer `dispositivos.revogar`; revoga o dispositivo e todos os refresh tokens dele.

**200** `{ "ok": true }`; `404` se não pertencer à empresa.

## Produção

### `POST /producoes`

Permissão: `producao.criar`. O `id` deve ser gerado pelo cliente; reenvios retornam `JA_RECEBIDO`.

```json
{
  "id": "6f1c2a3e-8b26-4b1d-9c3a-6f7d2a5b8e41",
  "turno_id": "<uuid>",
  "data_producao": "2026-10-26",
  "observacao": "Forno 2 com temperatura estável",
  "criado_em_cliente": "2026-10-26T16:10:00.000Z",
  "itens": [
    {
      "id": "0c9a7e10-3b1f-4a2c-8d5e-1f2a3b4c5d6e",
      "produto_id": "<uuid>",
      "lote_id": "<uuid>",
      "quantidade_produzida": 1500,
      "quantidade_refugo": 26,
      "motivo_refugo_id": "<uuid>",
      "consumo_argila": 3.9
    }
  ]
}
```

Regras:

- `itens` tem no mínimo 1 elemento; quantidades são inteiras positivas.
- Refugo maior que o produzido é rejeitado (RN-07); refugo maior que zero exige motivo.
- Produto, turno, motivo e lote precisam pertencer à empresa e estar ativos.
- Lotes recebem `produzida − refugo` em `quantidade_produzida`.
- Observação com relógio do cliente fora de 12 h recebe o marcador `[RELOGIO_SUSPEITO]`.
- O status inicial é `pendente_validacao`.

**201** `{ "status": "ACEITO", "id": "<uuid>" }`
**200** `{ "status": "JA_RECEBIDO", "id": "<uuid>" }`
**400** `{ "erro": "..." }` em caso de regra violada.

### `GET /producoes`

Permissão: `producao.listar`. Operadores veem apenas as próprias produções. Limite de 200 registros, ordenado por recebimento.

| Query    | Descrição                                       |
| -------- | ----------------------------------------------- |
| `de`     | Data inicial (`YYYY-MM-DD`)                     |
| `ate`    | Data final (`YYYY-MM-DD`)                       |
| `status` | `pendente_validacao`, `validado` ou `cancelado` |

Cada item inclui `turno_nome`, `criado_por_nome` e o array `itens` com `produto_nome` e `motivo_nome`.

### `POST /producoes/:id/validar`

Permissão: `producao.validar`. Idempotente.

**200** `{ "ok": true, "status": "validado" }`; `404` inexistente; `400` se cancelada.

### `POST /producoes/:id/cancelar`

Permissão: `producao.cancelar`. Corpo obrigatório:

```json
{ "motivo": "Apontamento duplicado do turno" }
```

Devolve as peças boas ao lote. Se parte do lote já foi expedida, retorna `409` e nada é alterado. Idempotente para produção já cancelada.

## Expedição

### `POST /entregas`

Permissão: `entrega.criar`. O `id` é gerado pelo cliente.

```json
{
  "id": "b3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f",
  "obra_id": "<uuid>",
  "veiculo_id": "<uuid>",
  "motorista_id": "<uuid>",
  "observacao": "Primeira carga de telha",
  "saida_em": "2026-10-26T15:20:00.000Z",
  "saida_lat": -22.9056,
  "saida_lng": -47.0608,
  "criado_em_cliente": "2026-10-26T15:20:00.000Z",
  "itens": [{ "lote_id": "<uuid>", "produto_id": "<uuid>", "quantidade": 500 }]
}
```

Regras:

- Obra, veículo e lote precisam estar ativos e pertencer à empresa.
- O produto do item deve ser o mesmo do lote.
- A quantidade não pode exceder o saldo (`produzida − expedida`).
- Sem `motorista_id`, o criador assume como motorista.
- Cria o status `saida_registrada`, soma `quantidade_expedida` e registra `qr_saida` por item e `gps_saida` quando há coordenadas.

**201** `{ "status": "ACEITO", "id": "<uuid>" }`; **200** para reenvio idempotente; **400** para regra violada.

### `GET /entregas`

Permissão: `entrega.listar`. Conferentes e motoristas veem apenas as entregas que criaram ou que dirigem. Limite de 200, ordenado por recebimento.

| Query    | Descrição                                                    |
| -------- | ------------------------------------------------------------ |
| `status` | `saida_registrada`, `em_transito`, `entregue` ou `cancelada` |

Cada item inclui `obra_nome`, `veiculo_placa`, `criado_por_nome` e `itens` com `lote_codigo` e `produto_nome`.

### `POST /entregas/:id/confirmar`

Permissão: `entrega.confirmar`. Corpo opcional:

```json
{ "lat": -22.9121, "lng": -47.0655, "chegada_em": "2026-10-26T18:20:00.000Z" }
```

Atualiza o status para `entregue`, grava `confirmacao` e, com coordenadas, `gps_chegada`. Idempotente. `400` se cancelada.

### `POST /entregas/:id/cancelar`

Permissão: `entrega.cancelar`. Mesmo contrato de motivo da produção. Devolve a quantidade expedida ao saldo dos lotes e marca `cancelada`.

### `GET /entregas/:id/timeline`

Permissão: `entrega.listar`. Devolve a entrega e os eventos em ordem cronológica, com nome do usuário e código do lote.

```json
{
  "entrega": { "id": "...", "status": "entregue" },
  "eventos": [
    { "tipo": "qr_saida", "criado_em": "...", "usuario_nome": "Pedro Conferente" },
    { "tipo": "gps_saida", "lat": -22.9056, "lng": -47.0608, "criado_em": "..." },
    { "tipo": "confirmacao", "criado_em": "..." }
  ]
}
```

## Sincronização offline

### `POST /sync/batch`

Permissão: `sync.enviar`. Máximo de 100 itens por lote. Cada item é processado independentemente.

```json
{
  "itens": [
    { "id": "<uuid>", "tipo": "producao", "dados": { "...": "payload de produção" } },
    { "id": "<uuid>", "tipo": "entrega", "dados": { "...": "payload de entrega" } }
  ]
}
```

**200**

```json
{
  "processados": 2,
  "resultados": [
    { "id": "<uuid>", "tipo": "producao", "status": "ACEITO" },
    { "id": "<uuid>", "tipo": "entrega", "status": "JA_RECEBIDO" }
  ],
  "servidor_em": "2026-10-26T17:00:00.000Z"
}
```

- `ACEITO` / `JA_RECEBIDO`: o cliente pode remover o item da fila.
- `REJEITADO`: o item permanece com o erro e pode ser corrigido e reenviado.
- Cada item gera uma linha em `log_sincronizacao`.
- Payloads inválidos são rejeitados sem interromper os demais itens.

Erros: `400` quando o lote está vazio ou excede 100 itens.

## Relatórios

### `GET /relatorios/dashboard`

Permissão: `dashboard.ver`.

| Query | Padrão        | Descrição    |
| ----- | ------------- | ------------ |
| `de`  | hoje − 7 dias | Data inicial |
| `ate` | hoje          | Data final   |

Resposta (resumida):

```json
{
  "periodo": { "de": "2026-10-19", "ate": "2026-10-26" },
  "producao": {
    "total_produzido": 33030,
    "total_refugo": 722,
    "total_argila": 87.4,
    "registros": 21,
    "pecas_boas": 32308,
    "meta_periodo": 38400,
    "percentual_meta": 84.1,
    "percentual_perdas": 2.2,
    "argila_por_peca": 0.003,
    "pendentes_validacao": 1
  },
  "por_motivo": [],
  "por_produto": [],
  "por_turno": [],
  "evolucao": [],
  "entregas": {
    "total": 2,
    "entregues": 1,
    "pendentes": 1,
    "canceladas": 0,
    "tempo_medio_horas": 3,
    "por_obra": []
  },
  "estoque_simples": []
}
```

Somente produção `validado` entra nos totais. A meta do período é a soma das metas diárias ativas multiplicada pelos dias do intervalo.

### `GET /relatorios/auditoria`

Permissão: `auditoria.ver`. Últimos 300 registros da empresa, com `usuario_nome`.

### `GET /relatorios/exportar`

Permissão: `dashboard.ver`. Mesmos filtros `de` e `ate`. Devolve CSV (`;`) com BOM UTF-8 e as colunas `data;turno;produto;produzido;refugo;motivo;argila;status;operador`. A exportação também é auditada.

## Saúde

### `GET /health`

Público.

```json
{
  "ok": true,
  "servico": "ceramix-api",
  "versao": "1.2.0",
  "ambiente": "production",
  "banco": "ok",
  "uptime_s": 120,
  "em": "2026-10-26T17:00:00.000Z"
}
```

Retorna `503` com `ok: false` e `banco: "indisponivel"` se o SQLite não responder.

## Erros e status

Formato padrão:

```json
{ "erro": "Mensagem legível", "detalhes": { "campo": ["motivo"] } }
```

| Status | Uso                                                                     |
| ------ | ----------------------------------------------------------------------- |
| `400`  | Validação, regra de negócio ou JSON inválido                            |
| `401`  | Sem token, token inválido/expirado, credenciais ou dispositivo inválido |
| `403`  | Perfil sem a permissão exigida ou origem CORS não permitida             |
| `404`  | Recurso inexistente na empresa ou rota desconhecida                     |
| `409`  | Duplicidade ou cancelamento bloqueado por estoque expedido              |
| `413`  | Corpo acima de 1 MB                                                     |
| `423`  | Conta temporariamente bloqueada por tentativas de login                 |
| `429`  | Rate limit global, de login ou de cadastro                              |
| `500`  | Erro inesperado; mensagem genérica + `requisicao_id`                    |

A matriz de permissões completa está em [ARQUITETURA.md](ARQUITETURA.md#7-matriz-de-permissões).
