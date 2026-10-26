# Changelog

Todas as mudanças relevantes do projeto são registradas aqui. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-10-26

### Adicionado

- Design system próprio (cores, tipografia, espaçamentos e componentes) com layout responsivo para desktop, tablet e celular.
- Navegação lateral adaptativa, barra inferior no mobile e atalhos da PWA para produção, entrega e painel.
- Fila offline com tela de pendências, reenvio individual, reenvio em lote e exibição do motivo de rejeição.
- Sincronização automática a cada 60 s, ao reconectar e ao voltar o foco, com catálogo em cache no IndexedDB.
- Rotação de refresh token, revogação por dispositivo, bloqueio temporário após cinco falhas de login e rate limits dedicados.
- Health check com verificação do SQLite, versão, ambiente e uptime.
- Logs estruturados com pino, `x-request-id` e ocultação de tokens, cookies e senhas.
- Auditoria com rótulos legíveis e busca por usuário, entidade ou ID.
- Exportação CSV do relatório de produção com auditoria do download.
- Dashboard com meta do período, perdas, argila por peça, evolução diária, tempos de entrega e estoque simples.
- Linha do tempo de entregas com eventos de QR, GPS e confirmação, ordenados cronologicamente.
- Seed demonstrativo coerente: semana de produção, lotes com saldo, duas entregas, timeline e auditoria.
- Testes de integração de autenticação, RBAC e fluxo completo de produção/entrega.
- Documentação de arquitetura, API e operação; Dockerfiles multi-stage, Docker Compose e pipeline de CI.
- ESLint 9, Prettier, EditorConfig e scripts de formatação no monorepo.

### Alterado

- Interface revisada de login, home, produção, entregas, dashboard, cadastros e auditoria, com textos em português correto e estados vazios informativos.
- Filtros de status no mobile passaram a quebrar linha em vez de serem cortados.
- Cartões de seleção dos formulários agora têm indicador visual de escolha.
- Estatísticas de entregas exibem `—` quando não há registros no período, em vez de `—/0`.
- Eventos de saída na timeline usam o horário real da saída, e não o horário de recebimento no servidor.
- Validação de ambiente centralizada com Zod, mensagens claras e proteção contra segredos fracos em produção.
- README reorganizado com visão geral, stack, scripts, configuração, Docker e limites do MVP.

### Corrigido

- Cancelamento de produção bloqueado quando parte do lote já foi expedida, com rollback da transação.
- Reversão de saldo ao cancelar produção ou entrega.
- Separação visual de métricas inline que apareciam coladas.
- Reenvios idempotentes de produção e entrega, sem duplicidade no servidor.
- Datas de validação do seed não podem mais ficar no futuro.

## [1.0.0] — MVP inicial

- Login com seis perfis e RBAC no servidor.
- Apontamento de produção com refugo, motivo e argila.
- Expedição por lote, obra e veículo com QR code e GPS.
- Sincronização em lote idempotente.
- Dashboard de meta, perdas e estoque simples.
- Auditoria append-only e cancelamento lógico.
- PWA instalável em React com IndexedDB.
