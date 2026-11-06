# Roteiro de testes manuais — Fase B (alarmes)

Use **apenas dados fictícios** (ex.: "Remédio Teste A", 1 comprimido).
Faça os testes em **build de desenvolvimento** (ver README › Build de desenvolvimento). O Expo Go não serve para validar segundo plano, app encerrado nem ações na notificação.

Anote para cada teste: aparelho e versão do sistema, horário programado, horário real de chegada (com minuto), resultado e observações.

## Preparação (todos os aparelhos)

1. Instalar a build, abrir o app, cadastrar "Remédio Teste A" com estoque 10 e um horário **3 minutos à frente**.
2. Na tela Hoje, tocar em **Permitir notificações** e aceitar.
3. Android 12+: no Perfil › Lembretes, se aparecer **Permitir alarmes no horário exato**, tocar e ativar "Alarmes e lembretes".
4. Perfil › **Enviar notificação de teste**: deve chegar em ~10 s.

## A. Disparo no horário

| # | Situação | Como fazer | Esperado |
|---|---|---|---|
| A1 | App aberto | Deixe o app na tela Hoje até o horário | Faixa da notificação aparece no horário |
| A2 | Segundo plano | Volte para a tela inicial do celular | Notificação no horário, com som |
| A3 | App encerrado | Feche o app pelo seletor de apps (deslizar para cima) | Notificação no horário |
| A4 | Tela bloqueada | Bloqueie a tela | Notificação na tela bloqueada. Com "Ocultar nome", não mostra o nome do remédio |
| A5 | Sem internet | Modo avião ligado | Notificação chega normalmente |
| A6 | Acompanhamento | Não responda | Em 30 min chega "ainda sem confirmação" |
| A7 | Economia de bateria (Android) | Ative a economia de bateria e repita A3 | Registrar o atraso observado. Não é falha do app se o sistema adiar |

## B. Ações na notificação

| # | Ação | Android | iOS | Esperado nos dois |
|---|---|---|---|---|
| B1 | Tomei | Botão **Tomei** (não abre o app) | Pressionar e segurar a notificação › **Tomei** (abre o app) | Dose fica "Tomada"; estoque cai **1 vez**; acompanhamento some |
| B2 | Tomei com app **encerrado** | Encerrar app › aguardar alerta › **Tomei** | Mesmo procedimento | Ao abrir o app: dose "Tomada", estoque 9. Se não registrou, a dose deve continuar "sem registro" (nunca "tomada" sem toque) e o acompanhamento deve chegar |
| B3 | Adiar 10 min | Botão **Adiar 10 min** | Menu › **Adiar 10 minutos** | Novo alerta 10 min depois; estoque **não muda**; horário da dose na tela continua o original |
| B4 | Adiar 15 min | Abrir pela notificação › tela da dose › Adiar › 15 min | Menu › **Adiar 15 minutos** | Igual a B3 com 15 min |
| B5 | Adiar 30 min | Botão **Adiar 30 min** | Menu › **Adiar 30 minutos** | Igual a B3 com 30 min |
| B6 | Abrir | Tocar no corpo da notificação | Tocar no corpo ou **Abrir o Cuidar** | Abre a tela da dose, com o medicamento correspondente |
| B7 | Toque duplo | Tocar **Tomei** no alerta principal e depois no acompanhamento | idem | Mensagem "já tinha um registro"; estoque cai só uma vez |
| B8 | Alerta antigo | Marcar "Não tomei" no app; depois tocar **Tomei** numa notificação antiga dessa dose ainda na bandeja | idem | Nada muda; aparece "já tinha um registro" |

## C. Sincronia com o banco

| # | Situação | Esperado |
|---|---|---|
| C1 | Confirmar pela tela Hoje antes do horário | Nenhum alerta toca para essa dose |
| C2 | Editar o horário de 08:00 para 08:05 | Toca **apenas** às 08:05 (não às 08:00) |
| C3 | Pausar o medicamento | Nenhum alerta até retomar |
| C4 | Arquivar | Nenhum alerta; histórico continua visível |
| C5 | Desligar lembretes no Perfil | Nenhum alerta; Hoje mostra "Lembretes desligados" |

## D. Reinício, fuso e permissões

| # | Situação | Como fazer | Esperado |
|---|---|---|---|
| D1 | Reinício do aparelho | Agende dose para 5 min, reinicie o celular e **não abra o app** | Notificação chega no horário |
| D2 | Reinício + ação | Após D1, tocar **Tomei** | Mesmo resultado de B1 |
| D3 | Troca de fuso | Configurações › Data e hora › fuso automático desligado › mudar para Manaus (−1 h) › abrir o app | Lembrete das 20:00 toca às 20:00 no horário de Manaus |
| D4 | Mudar hora manualmente | Adiantar o relógio para depois do horário | Dose aparece "Na hora"/"Não confirmada", **nunca** "Tomada" |
| D5 | Permissão negada | Recusar no pedido inicial | Hoje mostra "Notificações bloqueadas" com botão adequado |
| D6 | Permissão retirada depois | Desativar notificações do Cuidar nas configurações do sistema e voltar ao app | Hoje mostra o aviso imediatamente |
| D7 | iOS provisória | (se aplicável) | Aviso "chegam em silêncio na Central de Notificações" |
| D8 | Android sem alarme exato | Desativar "Alarmes e lembretes" | Aviso "pode atrasar alguns minutos"; registrar o atraso real |
| D9 | Muitas doses (iOS) | 6 horários/dia | Perfil indica até quando há lembretes; aviso "Abra o Cuidar" no fim do período |
| D10 | Atualização do app | Instalar nova build por cima | Lembretes continuam (o app reconcilia ao abrir) |

## Critério de aprovação

Só considere os lembretes "validados" em um modelo de aparelho depois de A1–A5, B1–B3, B6, C2, D1 e D3 passarem nele.
Registre também falhas parciais (ex.: atraso de 4 min em economia de bateria). Elas entram no relatório de limitações da Fase D.
