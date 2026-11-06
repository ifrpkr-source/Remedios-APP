# Cuidar — organização de medicamentos (MVP)

Aplicativo mobile brasileiro para quem usa medicamentos de forma contínua e para familiares que ajudam nessa rotina.
Nome e identidade visual são **provisórios**. O app é **organizacional**: não faz diagnóstico, não prescreve e não recomenda tratamentos.

Stack: Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · expo-sqlite (offline-first) · expo-notifications.
Supabase e família entram na Fase C.

## Como rodar

```bash
npm install
npm test            # 80 testes (domínio, SQLite real em memória e alarmes)
npm run typecheck
npx expo start      # Expo Go serve para navegar; alarmes exigem build de desenvolvimento
```

> Web não está configurado (expo-sqlite na web exige wasm e cabeçalhos COOP/COEP). Use Android ou iOS.

## Testar no celular

**Guia completo:** `docs/INSTALAR-NO-CELULAR.md` · **Checklist de testes:** `docs/CHECKLIST-CELULAR.md`.

Para validar alarmes, gere o **APK preview** (`eas build --profile preview --platform android`): ele funciona sozinho,
sem computador conectado. A build de desenvolvimento abaixo serve para programar.

## Build de desenvolvimento (para programar)

O Expo Go não valida segundo plano, app encerrado nem botões na notificação. A build de desenvolvimento carrega o código do computador (mesma rede Wi-Fi), por isso **não** é a melhor forma de validar alarmes com o app encerrado. Opções:

**Opção 1 — EAS na nuvem (não precisa de Android Studio/Xcode).** O plano gratuito do EAS tem fila e limite mensal de builds; nenhum pagamento é necessário para isso.
```bash
npx eas-cli@latest login                 # conta Expo gratuita
npx eas-cli@latest build:configure       # vincula o projeto (cria o projectId)
npx eas-cli@latest build --profile development --platform android
```
Ao terminar, o EAS mostra um link/QR para baixar o **APK**. Instale no celular (permitir "instalar apps desconhecidos"),
depois rode `npx expo start --dev-client` no computador e abra o app instalado.

iOS: `npx eas-cli@latest build --profile development --platform ios` exige **conta Apple Developer paga** e
registro do aparelho (`npx eas-cli@latest device:create`). Não foi feito.

**Opção 2 — local.** Android: instale o Android Studio e rode `npx expo run:android` com o celular conectado por USB.
iOS: Mac com Xcode e `npx expo run:ios --device`.

As pastas `android/` e `ios/` são geradas automaticamente (`app.json` é a fonte da configuração) e não devem ser editadas à mão.

## Estrutura

```
src/
  domain/        Regras puras, sem React Native (100% testáveis)
    time.ts        Horário de parede, fusos IANA, horário de verão
    schedule.ts    Gera doses a partir de versões de programação, pausas e arquivamento
    doseState.ts   Estado da dose derivado de eventos (inclui conflitos)
    stock.ts       Estoque derivado + previsão de esgotamento + aviso de reposição
    validation.ts  Validação estrutural (nunca clínica)
  data/          Persistência
    migrations.ts  Esquema SQLite versionado (PRAGMA user_version)
    repositories.ts Medicamentos, doses, estoque, configurações, privacidade
    expoAdapter.ts expo-sqlite → interface SqlDatabase
  services/
    agenda.ts      Junta programação + eventos: Hoje, Histórico, Estoque
  notifications/ Alarmes (Fase B)
    planner.ts     Calcula, a partir do banco, quais lembretes devem existir (função pura)
    manager.ts     Reconcilia o sistema operacional com o plano (idempotente, sem duplicatas)
    actions.ts     Trata Tomei / Adiar / Abrir com as mesmas regras da tela Hoje
    permissions.ts Estado de permissões → mensagem ao usuário
    expoScheduler.ts, setup.ts, backgroundTask.ts  Integração com expo-notifications
  state/
    AppProvider.tsx Abre o banco, roda migrações, expõe repositórios às telas
  ui/            Tema acessível e componentes (cartão de dose, formulário)
  app/           Rotas (Expo Router)
    (tabs)/        Hoje · Medicamentos · Estoque · Família · Perfil
    medicamento/   novo · [id] (detalhe) · editar/[id]
    historico.tsx
    dose/[key].tsx Tela da dose aberta pela notificação
  test/          Adaptador better-sqlite3, relógio controlável, dados sintéticos
.claude/skills/  UI UX Pro Max (instalada via CLI oficial, só neste projeto)
```

## Decisões de modelo (por que as regras inegociáveis valem)

| Regra | Como é garantida |
|---|---|
| Uma dose só é descontada uma vez | O estoque **não é um contador**: é derivado (contagem + entradas − doses confirmadas). Cada dose contribui no máximo uma vez, mesmo com registros duplicados de dois aparelhos. "Tomei" em dose já registrada é recusado; a escrita é serializada (`WriteQueue`), então toques simultâneos geram um único registro. |
| Nunca marcar como tomada automaticamente | Não existe caminho no código que produza `taken` sem um evento do usuário. Com o tempo, a dose passa para **"Não confirmada"**, nunca para "Tomada". |
| Adiar não altera a prescrição | Adiar grava um evento `snoozed` com novo horário de lembrete. Horário-base, programação e prazo de "não confirmada" continuam valendo. |
| Preservar histórico ao editar | Mudanças de horário/dias/datas criam uma **nova versão** válida a partir do momento da edição. Doses passadas continuam ligadas à versão antiga; doses registradas em horários removidos continuam visíveis. |
| Correções auditáveis | `dose_events` é somente-inclusão (trigger no SQLite bloqueia alteração). Corrigir grava um novo evento que aponta para o anterior. |
| Sincronizar sem sobrescrever conflitos | Registros divergentes para a mesma dose viram estado **"Registros divergentes"**, visível ao usuário, sem descontar estoque até ele decidir. A resolução também é um evento. (A sincronização em si é a Fase C; a regra já está implementada e testada.) |
| Fuso horário | A agenda segue o relógio local ("08:00" é 08:00 onde a pessoa estiver). Cada evento grava o instante absoluto e o deslocamento do fuso. |
| Exclusão de dados | Perfil › Excluir todos os dados (dupla confirmação) e Exportar meus dados. |

## Status das fases

- **Fase A — concluída:** projeto, arquitetura, modelo local e telas navegáveis com fluxos reais
  (cadastrar, editar, pausar, arquivar, Tomei / Adiar 10-15-30 / Não tomei, corrigir, estoque, previsão, histórico, exclusão).
- **Fase B — implementada e testada automaticamente; falta validar em aparelhos físicos** (roteiro em `docs/TESTES-MANUAIS-FASE-B.md`):
  lembretes no horário, acompanhamento "ainda sem confirmação", ações Tomei / Adiar 10-15-30 / Abrir,
  reconciliação com o banco, fuso e horário de verão, permissões, aviso de reposição.
- **Fase C:** Supabase (auth, Postgres, RLS em todas as tabelas), fila de sincronização, acompanhamento familiar somente-leitura e revogável.
- **Fase D:** testes de interface, testes em aparelhos físicos, build de teste privado (EAS), relatório de limitações.

## Alarmes: como funcionam

- O **banco é a fonte da verdade**. Os agendamentos do sistema são um reflexo dele, recalculado na abertura do app,
  ao voltar ao primeiro plano, após qualquer alteração e após cada ação na notificação.
- Cada dose tem identificadores estáveis (`cuidar.main.<dose>`, `cuidar.followup.<dose>`, `cuidar.snooze.<dose>`): **não há duplicatas**.
- Agendamento pelo sistema operacional (`expo-notifications`, gatilho por data). Nenhum timer JavaScript agenda alarmes.
- Android: entrega `alarmClock` (horário exato) quando "Alarmes e lembretes" está permitido; caso contrário, o app avisa que pode atrasar.
- Um toque é processado **uma única vez** (tabela `notification_responses`) e a dose é localizada na programação **atual**:
  alertas antigos de doses já registradas, pausadas, arquivadas ou com horário alterado não registram nada.
- Rede de segurança: lembrete de acompanhamento (padrão 30 min; configurável ou desligável no Perfil).

## Limitações por plataforma

**Android**
- No máximo **3 botões** por notificação: Tomei, Adiar 10 min e Adiar 30 min. "Adiar 15 min" fica na tela da dose (toque na notificação).
- Os botões funcionam com o app encerrado (tarefa em segundo plano). Se o sistema não executar a tarefa, nada é registrado e o acompanhamento ainda toca.
- Android 14+ nega "Alarmes e lembretes" por padrão; sem ele, o sistema pode atrasar avisos. Economia de bateria de alguns fabricantes também atrasa.
- Declara `SCHEDULE_EXACT_ALARM` (concedido pelo usuário). **Não** declara `USE_EXACT_ALARM`, restrito pelo Google Play a apps de despertador e agenda.
  Revisar a declaração de permissões na Play Console antes de qualquer publicação.
- Reinício do aparelho: a biblioteca reagenda pelo `RECEIVE_BOOT_COMPLETED`. Precisa de validação em aparelho físico.
- Até 200 agendamentos pendentes pelo app (o sistema limita cerca de 500 alarmes por app).

**iOS**
- O iOS **não entrega** ao app ações que não o abrem quando ele está encerrado. Por segurança, **todas as ações abrem o app** no iPhone e o registro é feito ao abrir.
- Limite do sistema: **64 notificações pendentes**. O app usa até 60, priorizando as doses mais próximas.
  Com muitas doses por dia, os lembretes cobrem poucos dias; o app avisa até quando e agenda um lembrete "Abra o Cuidar".
- Permissão provisória entrega em silêncio; o app avisa. "Foco"/"Não perturbe" pode silenciar lembretes.
- Builds para iPhone exigem conta Apple Developer paga (não foi criada).

**Ambos**
- **Os lembretes não foram testados em aparelho físico.** Não há garantia de disparo até o roteiro manual ser executado.
- Se o app não for aberto por muito tempo, o horizonte de lembretes (até 14 dias) termina.

## Limitações gerais

- Testado com testes automatizados, empacotamento Android/iOS (`expo export`) e geração nativa (`expo prebuild`).
- Isolamento entre contas não se aplica ainda: não há contas (Fase C, com RLS).
- Família é uma tela informativa; nenhum dado é compartilhado.
- Horários e datas são digitados (HH:MM, dd/mm/aaaa); seletores nativos ficaram para depois (não fazem parte do escopo da Fase B).
- Os testes usam somente dados sintéticos.
