# Checklist prático — teste no iPhone

Use **só dados fictícios**. Faça com a **build preview** (não com o Expo Go).
Anote o horário real de cada alerta. Casos extras estão em `TESTES-MANUAIS-FASE-B.md`.

**iPhone:** ______________________  **iOS:** ____  **Data:** ___/___/______

## Como o iPhone se comporta no Cuidar (leia antes)
- No iPhone, **todas as ações da notificação abrem o app**. O registro é feito quando ele abre. Isso é proposital:
  o iOS não repassa ao app botões tocados com ele fechado, e preferimos nunca perder nem registrar errado.
- Para ver as ações: **toque e segure** a notificação (ou deslize para a esquerda › Opções).
- O iOS guarda no máximo 64 lembretes pendentes. Com muitas doses, o Perfil mostra até quando há lembretes.

## 0. Antes de começar
- [ ] Build preview instalada; Modo de Desenvolvedor ligado
- [ ] Notificações permitidas: tela Hoje mostra "Lembretes ativos"
- [ ] Ajustes › Notificações › Cuidar: **Permitir notificações**, **Tela Bloqueada**, **Central de Notificações**, **Banners** e **Sons** ligados
- [ ] Ajustes › Notificações › **Resumo Programado**: o Cuidar **não** está incluído (se estiver, os lembretes atrasam até o próximo resumo)
- [ ] Notificação de teste do Perfil chegou
- [ ] "Remédio Teste A" cadastrado com estoque **10**, horário **3 min à frente** e acompanhamento de 30 min

## 1. Alarmes
| ✓ | Teste | Esperado | Horário real |
|---|---|---|---|
| [ ] | App aberto na tela Hoje | Faixa da notificação no horário | |
| [ ] | App em segundo plano (deslizar para a tela de início) | Notificação no horário, com som | |
| [ ] | App **encerrado** (seletor de apps › deslizar o Cuidar para cima) | Notificação no horário | |
| [ ] | Tela bloqueada | Aparece na tela bloqueada | |
| [ ] | Modo Avião | Chega mesmo assim | |
| [ ] | Chave **silenciosa** ligada | Chega sem som (comportamento normal do iPhone) | |
| [ ] | Não responder | "Ainda sem confirmação" chega ~30 min depois | |
| [ ] | Perfil › Nome na notificação › **Ocultar** | Notificação mostra só "Hora do seu medicamento" | |

## 2. Adiamento (tocar e segurar a notificação)
| ✓ | Teste | Esperado |
|---|---|---|
| [ ] | **Adiar 10 minutos** | O app abre e avisa "Lembrete adiado"; novo alerta 10 min depois; estoque continua **10** |
| [ ] | **Adiar 15 minutos** | Novo alerta 15 min depois |
| [ ] | **Adiar 30 minutos** | Novo alerta 30 min depois |
| [ ] | Tela Hoje após adiar | Dose mostra "Adiada" e o **horário original** |
| [ ] | Adiar com o app **encerrado** | O app abre e registra o adiamento; o novo alerta chega |

## 3. Confirmação de doses
| ✓ | Teste | Esperado |
|---|---|---|
| [ ] | **Tomei** com o app encerrado | O app abre, avisa "Dose registrada como tomada"; estoque **9** |
| [ ] | **Tomei** de novo no acompanhamento da mesma dose | Avisa "já tinha um registro"; estoque continua **9** |
| [ ] | Confirmar pela tela Hoje **antes** do horário | Nenhum alerta toca para essa dose |
| [ ] | Marcar "Não tomei" e depois **Tomei** numa notificação antiga | Nada muda; aviso "já tinha um registro" |
| [ ] | Tocar no corpo da notificação | Abre a tela da dose, com o medicamento |
| [ ] | Editar o horário (ex.: 14:00 → 14:05) | Toca **só** às 14:05 |
| [ ] | Pausar o medicamento | Nenhum alerta até retomar |
| [ ] | Deixar passar sem responder | Fica "Não confirmada", **nunca** "Tomada" |

## 4. Reinício do iPhone
| ✓ | Teste | Esperado | Horário real |
|---|---|---|---|
| [ ] | Dose em 5 min › desligar e ligar o iPhone › **desbloquear** › **não abrir o app** | Notificação no horário | |
| [ ] | Reiniciar e **não desbloquear** até o horário | Anote se chegou na tela bloqueada | |
| [ ] | Após o reinício, **Tomei** pela notificação | Registra uma vez; estoque cai 1 | |

## 5. Bateria, Foco e fuso
| ✓ | Teste | Esperado | Observação |
|---|---|---|---|
| [ ] | **Modo Pouca Energia** ligado, app encerrado | Notificação no horário (anote qualquer atraso) | |
| [ ] | **Foco / Não Perturbe** ligado | O iOS silencia ou segura a notificação. Para receber, adicione o Cuidar aos apps permitidos do Foco | |
| [ ] | Ajustes › Geral › Data e Hora › desligar "Automaticamente" › fuso **Manaus** › abrir o app | Lembrete das 20:00 toca às 20:00 de Manaus | |
| [ ] | Adiantar o relógio para depois do horário | Dose fica "Na hora"/"Não confirmada", nunca "Tomada" | |

## 6. Permissões
| ✓ | Teste | Esperado |
|---|---|---|
| [ ] | Ajustes › Notificações › Cuidar › desligar **Permitir notificações** › voltar ao app | Hoje mostra "Notificações bloqueadas" com **Abrir configurações do celular** |
| [ ] | Religar a permissão e voltar ao app | Volta a "Lembretes ativos" e os alertas são reprogramados |
| [ ] | Perfil › Lembretes › **Desligados** | Hoje mostra "Lembretes desligados"; nenhum alerta toca |

## 7. Muitas doses (limite do iOS)
- [ ] Cadastre 6 horários por dia. O Perfil deve mostrar até qual data há lembretes, e um aviso "Abra o Cuidar" deve chegar no fim desse período.

## Resultado
- [ ] **Aprovado neste iPhone:** seções 1 a 4 passaram
- Atrasos observados (minutos): __________
- Falhas e observações:

______________________________________________________________________

______________________________________________________________________
