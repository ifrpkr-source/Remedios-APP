# Checklist prático — teste em Android

Use **só dados fictícios**. Marque cada item e anote o horário real quando pedido.
O roteiro detalhado, com casos extras e iOS, está em `TESTES-MANUAIS-FASE-B.md`.

**Aparelho:** ______________________  **Android:** ____  **Data:** ___/___/______

## 0. Antes de começar
- [ ] APK **preview** instalado (não a build de desenvolvimento)
- [ ] Notificações permitidas (tela Hoje mostra "Lembretes ativos")
- [ ] "Alarmes e lembretes" permitido (Configurações › Apps › Acesso especial › Alarmes e lembretes › Cuidar)
- [ ] Notificação de teste do Perfil chegou
- [ ] Cadastrado "Remédio Teste A", estoque **10**, horário **3 min à frente**, acompanhamento de 30 min

## 1. Alarmes
| ✓ | Teste | Esperado | Horário real |
|---|---|---|---|
| [ ] | App aberto na tela Hoje | Notificação no horário | |
| [ ] | App em segundo plano (botão Início) | Notificação no horário, com som | |
| [ ] | App **encerrado** (deslizar para cima no seletor de apps) | Notificação no horário | |
| [ ] | Tela bloqueada | Notificação aparece na tela bloqueada | |
| [ ] | Modo avião | Notificação chega mesmo assim | |
| [ ] | Não responder | "Ainda sem confirmação" chega ~30 min depois | |

## 2. Adiamento
| ✓ | Teste | Esperado |
|---|---|---|
| [ ] | Botão **Adiar 10 min** na notificação | Novo alerta 10 min depois. Estoque continua **10** |
| [ ] | Botão **Adiar 30 min** | Novo alerta 30 min depois |
| [ ] | Tocar na notificação › tela da dose › Adiar › **15 min** | Novo alerta 15 min depois |
| [ ] | Na tela Hoje, depois de adiar | Dose mostra "Adiada" e o **horário original** |
| [ ] | Adiar com o app **encerrado** | Novo alerta chega. Se não chegar, anote; o acompanhamento ainda deve chegar |

## 3. Confirmação de doses
| ✓ | Teste | Esperado |
|---|---|---|
| [ ] | Botão **Tomei** na notificação (app encerrado) | Ao abrir: dose "Tomada", estoque **9** |
| [ ] | Tocar **Tomei** de novo no acompanhamento da mesma dose | Nada muda; estoque continua **9** |
| [ ] | Confirmar pela tela Hoje **antes** do horário | Nenhum alerta toca para essa dose |
| [ ] | Marcar "Não tomei" e depois tocar **Tomei** numa notificação antiga | Mensagem "já tinha um registro"; nada muda |
| [ ] | Editar o horário (ex.: 14:00 → 14:05) | Toca **só** às 14:05 |
| [ ] | Pausar o medicamento | Nenhum alerta até retomar |
| [ ] | Deixar uma dose passar sem responder | Fica "Não confirmada", **nunca** "Tomada" |

## 4. Reinício do telefone
| ✓ | Teste | Esperado | Horário real |
|---|---|---|---|
| [ ] | Dose para daqui a 5 min › reiniciar o celular › **não abrir o app** | Notificação no horário | |
| [ ] | Depois do reinício, tocar **Tomei** | Dose registrada, estoque cai uma vez | |
| [ ] | Desligar e ligar (em vez de reiniciar) com dose em 10 min | Notificação chega (se o celular já estiver ligado no horário) | |

## 5. Economia de bateria
Primeiro teste **com** a economia ligada e anote atrasos. Depois libere o app e repita.

| ✓ | Teste | Esperado | Atraso observado |
|---|---|---|---|
| [ ] | Economia de bateria **ligada**, app encerrado, tela bloqueada por 30 min | Pode atrasar; anote quanto | |
| [ ] | Mesmo teste com o Cuidar **sem restrição de bateria** | No horário ou com atraso mínimo | |
| [ ] | Celular parado por 1 h ou mais (modo soneca do Android) | Anote o atraso | |
| [ ] | Desativar "Alarmes e lembretes" | Tela Hoje avisa "pode atrasar alguns minutos"; anote o atraso real | |

**Como liberar o Cuidar da economia de bateria** (o caminho varia conforme o modelo):
- **Samsung:** Configurações › Aplicativos › Cuidar › Bateria › **Sem restrições**. Confira também Cuidados com o dispositivo › Bateria › Limites de uso em segundo plano: o Cuidar não pode estar em "Apps em suspensão".
- **Xiaomi / Redmi / POCO:** Configurações › Apps › Gerenciar apps › Cuidar › Economia de bateria › **Sem restrições**, e ative **Início automático**.
- **Motorola:** Configurações › Apps › Cuidar › Bateria › **Sem restrições**.
- **Outros modelos:** procure "bateria" ou "otimização" nas configurações do app. O site https://dontkillmyapp.com tem instruções por fabricante.

## Resultado
- [ ] **Aprovado neste aparelho:** todos os itens de 1, 2 (exceto app encerrado), 3 e 4 passaram
- Falhas e observações:

______________________________________________________________________

______________________________________________________________________
