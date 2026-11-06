# Instalar o Cuidar no iPhone (usando Windows)

## Resumo

| Pergunta | Resposta |
|---|---|
| Dá para instalar no iPhone sem Mac? | **Sim.** A build é feita na nuvem pelo EAS (Expo). O Windows só envia o projeto |
| Dá para instalar de graça? | **Não, para um app independente.** A Apple exige o **Apple Developer Program (US$ 99/ano)** para assinar apps instalados fora da App Store. Há um caminho gratuito **parcial** (Expo Go), descrito no fim |
| Precisa do computador ligado depois de instalar? | **Não**, no caminho recomendado (build *preview*). O app funciona sozinho, inclusive sem internet |
| Precisa de cabo USB? | Não. Tudo é feito por link/QR Code no iPhone |
| Quanto tempo o app instalado funciona? | Enquanto o certificado e o perfil de distribuição forem válidos (em geral até 1 ano) e a assinatura do Apple Developer estiver ativa. Depois, gera-se uma nova build |

> **Nada pago foi contratado nem executado.** Os passos abaixo que dependem da assinatura da Apple estão marcados com 💳.
> Faça-os só se decidir assinar.

---

## Caminho recomendado: build *preview* independente (💳 requer Apple Developer)

### 1. Preparar o computador (uma vez)
1. Instale o **Node.js LTS** (https://nodejs.org) e o **Git** (https://git-scm.com), com as opções padrão.
2. Crie uma conta gratuita na Expo: https://expo.dev/signup.
3. 💳 Assine o **Apple Developer Program** em https://developer.apple.com/programs/ com o mesmo Apple ID do seu iPhone.
   A aprovação pode levar de algumas horas a 2 dias. Sem ela, os passos 4 e 5 não funcionam.

### 2. Obter o projeto
No **PowerShell**:
```powershell
cd "$HOME\OneDrive\Desktop\Projetos"
git clone https://github.com/ifrpkr-source/Remedios-APP.git Remedios-APP
cd Remedios-APP
npm install
npm test
```
`npm test` deve terminar com **80 testes passando**.

### 3. Conectar o projeto à sua conta Expo (gratuito)
```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```
O `init` acrescenta um `projectId` ao `app.json`. Faça commit dessa alteração depois.

### 4. 💳 Registrar o seu iPhone (`eas device:create`)
A Apple só permite instalar builds internas em aparelhos registrados (até 100 iPhones por ano).

```powershell
npx eas-cli@latest device:create
```
O comando faz algumas perguntas:
1. **Usar a sua conta Expo?** → `Y`.
2. **Apple ID** → digite o Apple ID da assinatura de desenvolvedor e confirme o código de dois fatores que chega no iPhone.
3. **Equipe (Team)** → escolha a sua (aparece seu nome).
4. **Como registrar os aparelhos?** → escolha **Website**. O terminal mostra um **link** (e, em geral, um QR Code).

No **iPhone**:
1. Abra o link no **Safari** (não use outro navegador) e toque em **Download Profile** / **Baixar perfil**.
2. Abra **Ajustes**. No topo aparece **Perfil Transferido**: toque nele.
3. Toque em **Instalar**, digite o código do iPhone e confirme **Instalar** de novo.
4. O Safari volta e mostra uma mensagem de sucesso. O aparelho foi registrado.

Para conferir: `npx eas-cli@latest device:list`.

> Esse perfil serve **só para enviar o identificador (UDID)** do iPhone. Depois do registro, você pode removê-lo em
> Ajustes › Geral › VPN e Gerenciamento de Dispositivos.

### 5. 💳 Gerar a build *preview* para iPhone
```powershell
npx eas-cli@latest build --platform ios --profile preview
```
Durante o comando:
- **Fazer login na conta Apple?** → `Y` (mesmo Apple ID).
- **Gerar certificado de distribuição?** → `Y`. Ele fica guardado com segurança na sua conta Expo. **Não** coloque no Git.
- **Gerar perfil de provisionamento ad hoc?** → `Y`.
- **Selecionar aparelhos** → marque o seu iPhone (barra de espaço) e confirme com Enter.

A build leva de 15 a 40 minutos (há fila no plano gratuito do EAS). Você pode fechar o terminal; acompanhe em https://expo.dev.

> Registrou outro iPhone depois? É preciso gerar uma build nova (ou usar `eas build:resign`) para ele conseguir instalar.

### 6. Instalar no iPhone
1. Na página da build em expo.dev, toque em **Install**. Aparece um **QR Code**.
2. Leia o QR com a **câmera do iPhone** e toque no link. Confirme **Instalar**.
3. O ícone do **Cuidar** aparece na tela de início.

### 7. Ligar o Modo de Desenvolvedor (iOS 16 ou mais novo, uma vez)
1. Toque no ícone do Cuidar. Aparece um aviso pedindo o Modo de Desenvolvedor: toque em **OK**.
2. Vá em **Ajustes › Privacidade e Segurança › Modo de Desenvolvedor** e ative.
3. Toque em **Reiniciar**.
4. Depois de reiniciar, desbloqueie o iPhone, toque em **Ativar** no aviso e digite o código.
5. Abra o Cuidar.

### 8. Primeira abertura
1. Cadastre "Remédio Teste A" (dados fictícios).
2. Na tela Hoje, toque em **Permitir notificações** e escolha **Permitir**.
3. Perfil › **Enviar notificação de teste**. Ela deve chegar em cerca de 10 segundos.
4. Siga o checklist em `docs/CHECKLIST-IPHONE.md`.

**A partir daqui, o computador pode ficar desligado.**

### Atualizar e remover
- Nova versão: repita o passo 5 e instale por cima (os dados ficam).
- **Apagar o app apaga todos os dados do Cuidar** no iPhone.

### Problemas comuns
| Problema | O que fazer |
|---|---|
| "Não foi possível instalar" | O iPhone não estava registrado quando a build foi feita. Repita os passos 4 e 5 |
| Ícone abre e fecha | Ligue o Modo de Desenvolvedor (passo 7) |
| Pedido de Apple ID falha | Confirme se a assinatura do Apple Developer já foi aprovada (pode levar até 48 h) |
| Notificação de teste não chega | Ajustes › Notificações › Cuidar: Permitir notificações ligado, com Banners e Sons. Veja também "Resumo Programado" e "Foco" no checklist |

---

## Caminho gratuito e parcial: Expo Go (sem assinatura, com computador)

Serve para ver as telas e um primeiro teste de lembrete **sem pagar**. **Não valida** o app encerrado, o reinício do iPhone
nem as ações da notificação como no app real.

1. Instale o **Expo Go** pela App Store.
2. No PC (mesma rede Wi-Fi do iPhone), dentro da pasta do projeto:
   ```powershell
   npx expo start --go
   ```
3. Leia o QR Code do terminal com a **câmera do iPhone**. O projeto abre dentro do Expo Go.

Limitações:
- O PC precisa estar ligado, com o comando rodando, sempre que o app for aberto ou recarregado.
- As notificações aparecem como sendo do **Expo Go**, não do Cuidar.
- O Expo Go da App Store precisa ser compatível com o SDK 58 do projeto. Se ele disser que o projeto é incompatível, este caminho não funciona.
- Os dados ficam dentro do Expo Go e podem ser perdidos ao atualizá-lo.

---

## Referências oficiais
- Distribuição interna (ad hoc) com EAS: https://docs.expo.dev/build/internal-distribution/
- Registrar iPhone e instalar build: https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/
- Modo de Desenvolvedor no iOS: https://docs.expo.dev/guides/ios-developer-mode/
