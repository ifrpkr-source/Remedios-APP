# Instalar o Cuidar no seu celular Android

## Resumo

| Pergunta | Resposta |
|---|---|
| Qual build usar para testar alarmes? | **APK "preview"** (perfil `preview` do `eas.json`) |
| Precisa de computador conectado depois de instalar? | **Não.** O APK preview é independente: funciona sem cabo, sem Wi-Fi e sem o computador ligado |
| Precisa de computador para gerar o APK? | Sim, uma vez, só para enviar o projeto ao EAS (o serviço de build da Expo, na nuvem). Não precisa de Android Studio |
| Custa algo? | Não. A conta Expo e o plano gratuito do EAS bastam; o build entra em fila |
| iPhone? | Exige conta Apple Developer paga. Fora desta etapa |

> **Por que não usar a "build de desenvolvimento" para testar alarmes?** Ela carrega o código a partir do computador
> (`npx expo start --dev-client`). Com o app encerrado ou após reiniciar o celular, o código pode não estar disponível,
> e os botões da notificação não funcionam como no app real. Ela serve para programar. **Para validar alarmes, use o APK preview.**

## Passo a passo (Windows, uma única vez)

### 1. Preparar o computador
1. Instale o **Node.js LTS** em https://nodejs.org (aceite as opções padrão).
2. Instale o **Git** em https://git-scm.com (opções padrão).
3. Crie uma conta gratuita em https://expo.dev/signup.

### 2. Obter o projeto
Abra o **Prompt de Comando** ou o **PowerShell**:

```powershell
cd "$HOME\OneDrive\Desktop\Projetos"
git clone https://github.com/ifrpkr-source/Remedios-APP.git Remedios-APP
cd Remedios-APP
npm install
npm test
```
`npm test` deve terminar com **80 testes passando**.

> Se preferir continuar usando a pasta `APP Remedios`, os arquivos são os mesmos; rode `npm install` dentro dela.

### 3. Gerar o APK
```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile preview --platform android
```
- `init` cria o projeto na sua conta Expo e acrescenta um `projectId` ao `app.json`. Faça commit dessa alteração depois.
- Na primeira build, o EAS pergunta se pode **gerar um keystore Android**: responda **Sim**. Ele fica guardado na sua conta Expo.
  **Não** baixe nem coloque o keystore no Git.
- O build leva de 10 a 30 minutos (há fila no plano gratuito). Você pode fechar o terminal; o progresso aparece em https://expo.dev.

### 4. Instalar no celular
1. Quando terminar, o terminal e a página do build em expo.dev mostram um **link e um QR Code**.
2. No celular, abra o link (ou leia o QR com a câmera) e baixe o arquivo `.apk`.
3. Toque no arquivo. O Android pede para **permitir instalação de fontes desconhecidas** para o navegador: permita.
4. O Play Protect pode avisar que o app é desconhecido: toque em **Mais detalhes › Instalar mesmo assim**.
5. Abra o **Cuidar**.

### 5. Primeira abertura
1. Cadastre um medicamento de teste (ex.: "Remédio Teste A").
2. Na tela Hoje, toque em **Permitir notificações** e aceite.
3. Se aparecer **Permitir alarmes no horário exato**, toque e ative **Alarmes e lembretes** para o Cuidar.
4. Perfil › **Enviar notificação de teste**. Ela deve chegar em cerca de 10 segundos.
5. Siga o checklist em `docs/CHECKLIST-CELULAR.md`.

## Atualizar ou remover

- Para testar uma versão nova: repita o passo 3 e instale o novo APK **por cima** (os dados são mantidos).
- **Desinstalar o app apaga todos os dados** do Cuidar no aparelho (medicamentos, histórico e estoque).

## Se algo der errado

| Problema | O que fazer |
|---|---|
| `npx` não é reconhecido | Feche e abra o terminal depois de instalar o Node.js |
| Build falhou no EAS | Abra a página do build em expo.dev › copie a seção vermelha do log e envie para análise |
| "App não instalado" | Desinstale uma versão antiga com outra assinatura e tente de novo |
| Notificação de teste não chega | Configurações do Android › Apps › Cuidar › Notificações: ative tudo. Depois veja a seção "Economia de bateria" do checklist |

## Opcional: build de desenvolvimento (para programar, não para validar alarmes)

```powershell
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```
O celular e o computador precisam estar na **mesma rede Wi-Fi**, com o comando `expo start` rodando enquanto você usa o app.

## Skill de design (opcional, só para quem desenvolve com o Claude Code)

A skill UI UX Pro Max não vai para o repositório. Para reinstalar no projeto:
```powershell
npx ui-ux-pro-max-cli init --ai claude
```
