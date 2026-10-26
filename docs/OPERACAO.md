# Operação

Guia para instalar, executar, monitorar e recuperar o Ceramix em desenvolvimento e em produção.

## 1. Requisitos

| Item     | Versão / observação                                        |
| -------- | ---------------------------------------------------------- |
| Node.js  | 20 ou superior (CI e Docker usam 22)                       |
| npm      | 10 ou superior                                             |
| Sistema  | Linux, macOS ou Windows                                    |
| Opcional | Docker 24+ e Docker Compose v2 para execução em containers |

O `better-sqlite3` publica binários pré-compilados para as plataformas comuns. Se a instalação compilar do zero, instale `python3`, `make` e um compilador C++ (`build-essential` no Debian/Ubuntu).

## 2. Instalação local

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:3001/api/health>
- Banco padrão: `apps/api/data/ceramix.db`

O comando `npm run setup` executa instalação, ícones da PWA, migração e seed de uma vez — mas exige o `.env` criado antes.

### Produção local (sem Docker)

```bash
npm run build
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run start
```

O bundle do front fica em `apps/web/dist` e deve ser servido por um servidor estático que também faça proxy de `/api` para a porta da API. O `npm run start` executa somente a API.

## 3. Variáveis de ambiente

A API valida o ambiente com Zod antes de abrir a porta. Se algo estiver inválido, o processo encerra mostrando o campo e o motivo.

| Variável               | Obrigatória | Padrão                  | Observações                                                  |
| ---------------------- | :---------: | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`             |             | `development`           | `production` ativa cookies `Secure` e checagens extras       |
| `PORT`                 |             | `3001`                  | Porta HTTP                                                   |
| `LOG_LEVEL`            |             | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `TRUST_PROXY`          |             | `1`                     | Ajuste para o número de proxies reversos                     |
| `JWT_SECRET`           |      ✓      | —                       | Mínimo 32 caracteres                                         |
| `JWT_REFRESH_SECRET`   |      ✓      | —                       | Mínimo 32 caracteres e diferente do anterior                 |
| `ACCESS_TOKEN_MINUTES` |             | `15`                    | Máximo 1440                                                  |
| `REFRESH_TOKEN_DAYS`   |             | `7`                     | Máximo 90                                                    |
| `CORS_ORIGIN`          |             | `http://localhost:5173` | Uma ou mais origens separadas por vírgula                    |
| `DB_PATH`              |             | `./data/ceramix.db`     | Relativo a `apps/api` ou caminho absoluto                    |
| `RATE_LIMIT_MAX`       |             | `300`                   | Requisições por minuto por IP                                |

Gere segredos fortes com:

```bash
openssl rand -hex 32
```

Em `production`, a API recusa segredos contendo `dev`, `troque`, `secret` ou `changeme`, e recusa access e refresh iguais.

## 4. Banco de dados

### Migrações

```bash
npm run db:migrate
```

O schema é idempotente (`CREATE TABLE IF NOT EXISTS`) e pode ser aplicado quantas vezes for necessário. O container da API executa essa etapa a cada inicialização.

### Seed de demonstração

```bash
npm run db:seed
```

O seed só roda com o banco vazio. Ele cria:

- Empresa, seis usuários e o catálogo completo (produtos, turnos, motivos, lotes, obras, veículos, metas).
- Seis dias de produção mais três registros de hoje, sendo um pendente de validação.
- Duas entregas: uma concluída com timeline e GPS, outra em andamento.
- Registros de auditoria coerentes com os lançamentos.

> **Atenção:** o seed usa a senha `123456` e não deve ser executado em ambiente real.

### Cadastro de novas empresas

A rota pública `/cadastro` permite que uma nova empresa crie a própria conta. Cada cadastro cria, em transação, a empresa, o primeiro usuário com o cargo escolhido e um catálogo inicial; a conta já entra autenticada e só enxerga os próprios dados.

- O login é único em toda a base. Se o usuário já existir em outra empresa, o cadastro retorna `409`.
- O limite é de 10 cadastros por hora por IP. Atrás de proxy reverso, mantenha `TRUST_PROXY` correto para o limite usar o IP real.
- Em ambientes controlados, restrinja `/cadastro` no proxy reverso (ou remova o link do login) até definir uma política de autoatendimento, verificação de e-mail ou aprovação de empresas.

### Reiniciar a demonstração

O reset apaga o banco. Faça backup antes se houver qualquer dado importante:

```bash
cp apps/api/data/ceramix.db apps/api/data/ceramix.db.bak
rm -f apps/api/data/ceramix.db apps/api/data/ceramix.db-wal apps/api/data/ceramix.db-shm
npm run db:migrate && npm run db:seed
```

### Backup

Com o SQLite em modo WAL, o backup correto considera os arquivos `-wal` e `-shm` ou usa a API de backup:

```bash
sqlite3 apps/api/data/ceramix.db ".backup 'backup-ceramix-$(date +%F).db'"
```

Agende a cópia para um diretório fora do servidor. Para restaurar, pare a API, substitua o arquivo principal e remova os arquivos `-wal`/`-shm` antigos.

### Consultas úteis

```bash
sqlite3 apps/api/data/ceramix.db "SELECT status, COUNT(*) FROM producoes GROUP BY status;"
sqlite3 apps/api/data/ceramix.db "SELECT codigo, quantidade_produzida - quantidade_expedida AS saldo FROM lotes;"
sqlite3 apps/api/data/ceramix.db "SELECT entidade, acao, criado_em FROM auditoria ORDER BY criado_em DESC LIMIT 20;"
```

## 5. Docker

### Subir

```bash
cp .env.docker.example .env
# edite o .env e troque os dois segredos
docker compose up --build -d
docker compose logs -f api
```

- App: <http://localhost:8080>
- API pela rede interna: `http://api:3001`
- Banco: volume `ceramix_dados`, montado em `/data`

Com `SEED_ON_START=true` (padrão do compose), a API aplica migrações, executa o seed (que ignora bancos com dados) e inicia. Defina `SEED_ON_START=false` em produção.

### Operação diária

```bash
docker compose ps
docker compose logs -f --tail=100
docker compose restart api
docker compose down            # mantém o volume
docker compose down -v         # apaga também o banco — irreversível
```

### Backup no Docker

```bash
docker compose exec api sh -c "sqlite3 /data/ceramix.db \".backup '/data/backup-$(date +%F).db'\""
docker compose cp api:/data/backup-2026-10-26.db ./backup-2026-10-26.db
```

## 6. Monitoramento

- **Health check:** `GET /api/health` devolve `ok`, versão, ambiente, banco e uptime. Use um monitor externo com intervalo de 30–60 s.
- **Logs:** pino em JSON em produção, com `x-request-id` em toda resposta. Erros 5xx incluem `requisicao_id` no corpo para correlação.
- **Rate limit:** respostas `429` indicam abuso ou `TRUST_PROXY` mal configurado (IP do proxy no lugar do cliente).
- **Disco:** acompanhe o crescimento do arquivo SQLite e dos arquivos WAL; o volume esperado para o MVP é baixo, mas auditoria e eventos crescem com o uso.
- **Sessões:** `refresh_tokens` revogados permanecem na tabela para auditoria; uma limpeza periódica pode remover tokens expirados há mais de 90 dias.

## 7. Solução de problemas

| Sintoma                                             | Causa provável                              | Ação                                                                           |
| --------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| API encerra com “Configuração de ambiente inválida” | `.env` ausente ou variável fora do padrão   | Copie `apps/api/.env.example`, preencha e reinicie                             |
| `EADDRINUSE` na porta 3001                          | Outra instância da API rodando              | Encerre o processo ou mude `PORT`                                              |
| Erro de compilação do `better-sqlite3`              | Sem binário pré-compilado para a plataforma | Instale Python 3 e build tools e rode `npm rebuild better-sqlite3`             |
| Login retorna “Origem não permitida pelo CORS”      | `CORS_ORIGIN` não inclui a origem do front  | Adicione a URL exata e reinicie a API                                          |
| Login retorna `423`                                 | Cinco falhas consecutivas                   | Aguarde 15 minutos ou limpe `tentativas_falhas`/`bloqueado_ate`                |
| Login retorna “Dispositivo revogado”                | Dispositivo removido por um admin           | Limpe o IndexedDB do navegador para gerar um novo dispositivo                  |
| Sessão expira em loop                               | Refresh token revogado ou cookie bloqueado  | Faça logout, limpe `sessionStorage` e entre novamente                          |
| `429` mesmo com pouco uso                           | `TRUST_PROXY` diferente da topologia real   | Ajuste para o número de proxies confiáveis                                     |
| Registros ficam em “Pendentes”                      | Erro de validação ou diferença de catálogo  | Abra a fila, leia o motivo, atualize o catálogo e reenvie                      |
| `SQLITE_BUSY`                                       | Escrita concorrente acima do `busy_timeout` | Reduza concorrência; em escala, migre para PostgreSQL                          |
| PWA mostra versão antiga                            | Service worker com cache anterior           | Recarregue com “Atualizar” ou limpe o cache do site                            |
| Data/hora estranha em registros offline             | Relógio do dispositivo errado               | Corrija o relógio; a API marca `[RELOGIO_SUSPEITO]` quando há diferença > 12 h |

## 8. Checklist antes de produção

1. `NODE_ENV=production` e segredos novos, distintos e fora do repositório.
2. HTTPS obrigatório no proxy reverso (cookies `Secure` só trafegam em TLS).
3. `CORS_ORIGIN` restrito ao domínio real do app.
4. `SEED_ON_START=false` e nenhum usuário de demonstração ativo.
5. Política de cadastro público definida (restringir `/cadastro`, verificação de e-mail ou aprovação manual).
6. Backup automático do SQLite com teste de restauração.
7. Monitoramento externo do `/api/health` e alerta de indisponibilidade.
8. `TRUST_PROXY` alinhado à topologia para IP real, rate limit e auditoria corretos.
9. Política de retenção de logs, auditoria e tokens definida.
10. Testes e build passando no CI antes do deploy.
