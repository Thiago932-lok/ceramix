# Ceramix

Plataforma PWA de apontamento de produção e expedição para a indústria cerâmica. O operador registra a produção mesmo sem rede; o conferente controla a saída dos lotes por QR code e GPS; a gestão acompanha meta, refugo e entregas em tempo real.

Projeto desenvolvido para o desafio **INTEGRA SENAI 2026** (Cerâmica Integra).

---

## Destaques

- **Offline-first de verdade** — registros de produção e entrega entram em uma fila local (IndexedDB) e são enviados quando a conexão volta, com idempotência por ID de cliente.
- **Rastreabilidade completa** — cada criação, validação, confirmação e cancelamento gera auditoria com usuário, dispositivo e horário.
- **Conta própria em minutos** — o cadastro público cria a empresa, o primeiro usuário com cargo e um catálogo inicial; o login pede apenas usuário e senha.
- **RBAC no servidor** — seis perfis com permissões explícitas; a interface esconde o que o perfil não pode fazer, mas a API é quem decide.
- **Sessão segura** — access token curto (15 min por padrão), refresh rotativo persistido com hash, cookies `httpOnly` e revogação de dispositivo.
- **Nada é apagado** — cancelamentos são lógicos, exigem motivo e revertem o estoque quando possível.
- **PWA instalável** — service worker com cache de catálogo, atalhos de produção/entrega e layout responsivo para celular, tablet e desktop.

## Stack

| Camada         | Tecnologias                                                    |
| -------------- | -------------------------------------------------------------- |
| Front-end      | React 19, Vite 6, React Router 7, Dexie 4, vite-plugin-pwa     |
| Back-end       | Node.js 20+, Express 4, better-sqlite3, Zod, JWT, pino, helmet |
| Qualidade      | ESLint 9, Prettier, Vitest + Supertest, GitHub Actions         |
| Infraestrutura | Docker multi-stage, Nginx, Docker Compose                      |

## Rodando localmente

Pré-requisitos: **Node.js 20+** e **npm 10+**. O `better-sqlite3` costuma usar binário pré-compilado; se a instalação compilar do zero, tenha `python3` e um compilador C++ disponíveis.

```bash
git clone <url-do-repositorio> ceramix
cd ceramix
npm install

# configuração da API (obrigatório na primeira execução)
cp apps/api/.env.example apps/api/.env

npm run db:migrate
npm run db:seed
npm run dev
```

Ou, de uma vez, após criar o `.env`:

```bash
npm run setup
npm run dev
```

- Aplicação: <http://localhost:5173>
- API: <http://localhost:3001/api/health>

O `npm run setup` instala dependências, gera os ícones da PWA, aplica as migrações e popula o banco de demonstração.

### Usuários de demonstração

| Login        | Senha    | Perfil     |
| ------------ | -------- | ---------- |
| `admin`      | `123456` | Admin      |
| `gestor`     | `123456` | Gestor     |
| `supervisor` | `123456` | Supervisor |
| `operador`   | `123456` | Operador   |
| `conferente` | `123456` | Conferente |
| `motorista`  | `123456` | Motorista  |

O seed cria uma semana de produção coerente, três lotes com saldo, duas entregas (uma concluída com linha do tempo e outra em andamento) e três registros de auditoria. Ele é idempotente: se já houver empresa cadastrada, não faz nada.

### Criar uma conta

A tela **Criar conta** (`/cadastro`) é pública. Ela cria uma nova empresa, o primeiro usuário com o **cargo** escolhido e um catálogo inicial com três turnos, cinco motivos de refugo, um produto, um lote, um cliente, uma obra, um veículo e uma meta diária.

- O cargo (Administrador, Gestor, Supervisor, Operador, Conferente ou Motorista) vira o perfil de acesso e define as permissões no servidor. No login, informe apenas usuário e senha.
- Cada conta enxerga somente os dados da própria empresa.
- O usuário de acesso é único em toda a base; duas empresas não podem usar o mesmo login.
- Escolha **Administrador** se você for o responsável por configurar a conta e criar os demais usuários.

## Scripts

| Comando                | O que faz                                         |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Sobe API (`:3001`) e web (`:5173`) em paralelo    |
| `npm run dev:api`      | Sobe somente a API com `--watch`                  |
| `npm run dev:web`      | Sobe somente o Vite                               |
| `npm run setup`        | Instala, gera ícones, migra e popula o banco      |
| `npm run db:migrate`   | Aplica o schema idempotente                       |
| `npm run db:seed`      | Popula o banco de demonstração                    |
| `npm run build`        | Gera o bundle de produção da PWA                  |
| `npm run start`        | Executa a API em modo produção                    |
| `npm test`             | Roda os testes de integração (Vitest + Supertest) |
| `npm run lint`         | Analisa o código com ESLint                       |
| `npm run format`       | Formata com Prettier                              |
| `npm run format:check` | Verifica a formatação sem alterar arquivos        |

## Configuração

As variáveis são validadas por Zod na inicialização; valores inválidos encerram o processo com uma mensagem clara. Veja o arquivo completo em [`apps/api/.env.example`](apps/api/.env.example).

| Variável               | Padrão                  | Observação                                            |
| ---------------------- | ----------------------- | ----------------------------------------------------- |
| `NODE_ENV`             | `development`           | `development`, `test` ou `production`                 |
| `PORT`                 | `3001`                  | Porta HTTP da API                                     |
| `LOG_LEVEL`            | `info`                  | Nível do pino (`fatal`…`silent`)                      |
| `TRUST_PROXY`          | `1`                     | Proxies reversos confiáveis para IP real e rate limit |
| `JWT_SECRET`           | —                       | Obrigatório, mínimo 32 caracteres                     |
| `JWT_REFRESH_SECRET`   | —                       | Obrigatório, diferente do access secret               |
| `ACCESS_TOKEN_MINUTES` | `15`                    | Validade do access token                              |
| `REFRESH_TOKEN_DAYS`   | `7`                     | Validade do refresh token                             |
| `CORS_ORIGIN`          | `http://localhost:5173` | Origens separadas por vírgula                         |
| `DB_PATH`              | `./data/ceramix.db`     | Relativo a `apps/api` ou absoluto                     |
| `RATE_LIMIT_MAX`       | `300`                   | Requisições por minuto por IP                         |

Em `NODE_ENV=production`, a API recusa segredos óbvios (contendo `dev`, `troque`, `secret` ou `changeme`) e segredos iguais.

## Estrutura

```
ceramix/
├─ apps/
│  ├─ api/                  # Express + SQLite
│  │  ├─ src/
│  │  │  ├─ db/             # schema, migrações, seed, conexão
│  │  │  ├─ middleware/     # autenticação JWT
│  │  │  ├─ routes/         # auth, catálogo, produção, entrega, sync, relatórios
│  │  │  ├─ utils/          # auditoria, permissões, erros HTTP
│  │  │  ├─ app.js          # composição do Express
│  │  │  └─ server.js       # bootstrap e shutdown gracioso
│  │  └─ tests/             # autenticação, RBAC e fluxo ponta a ponta
│  └─ web/                  # PWA React
│     ├─ src/
│     │  ├─ components/     # layout, ícones, UI base
│     │  ├─ context/        # auth, sincronização, toasts, diálogos
│     │  ├─ lib/            # cliente HTTP, Dexie, formatadores
│     │  └─ pages/          # login, cadastro, home, produção, entregas, dashboard…
│     └─ vite.config.js     # PWA, proxy /api e build
├─ docs/                    # arquitetura, API e operação
├─ scripts/                 # geração de ícones da PWA
├─ docker-compose.yml
└─ .github/workflows/ci.yml
```

## Docker

```bash
cp .env.docker.example .env
# edite o .env e troque os segredos (openssl rand -hex 32)
docker compose up --build
```

- Aplicação: <http://localhost:8080>
- API interna: `http://api:3001` (o Nginx do front faz o proxy de `/api`)
- Banco persistido no volume `ceramix_dados`

O container da API aplica as migrações na inicialização. Com `SEED_ON_START=true` (padrão no compose) ele também popula o banco de demonstração; o seed se recusa a rodar se já existirem dados. Para desativar, defina `SEED_ON_START=false`.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md) — camadas, modelo de dados, offline-first, RBAC e decisões.
- [API](docs/API.md) — endpoints, payloads, status e matriz de permissões.
- [Operação](docs/OPERACAO.md) — ambiente, backup, Docker, monitoramento e solução de problemas.
- [Changelog](CHANGELOG.md) — histórico de versões.

## Escopo e limites do MVP

- A API usa SQLite para manter o pacote simples; o modelo de dados segue o desenho relacional do projeto e pode migrar para MySQL/PostgreSQL sem mudar os contratos HTTP.
- NF-e, integração fiscal e telemetria IoT ficam fora do MVP.
- GPS é registrado a partir da localização informada pelo navegador; não há rastreamento contínuo do veículo.
- O ambiente de demonstração usa senhas simples (`123456`); troque todas antes de qualquer uso real.
- O cadastro público é aberto por padrão, com limite de 10 contas por hora por IP. Em produção, avalie restringir a rota `/cadastro` no proxy reverso, adicionar verificação de e-mail ou aprovação manual de empresas.

## Licença

Material acadêmico desenvolvido para o INTEGRA SENAI 2026. Defina a licença de distribuição antes de publicar o repositório.
