# SafraViva Mobile

Aplicativo React Native bare com TypeScript, preparado para Android e iOS.
O aplicativo oferece telas de início, atividades, nova atividade, sincronização,
talhões, propriedades, financeiro, SafraIA por texto e mais, baseadas nos dados do
backend. A lista de atividades permite consultar registros do servidor e do
aparelho, pesquisar e abrir detalhes. O mapa e o assistente por voz ainda não
estão disponíveis.

Na tela inicial, **Atalhos rápidos** leva ao cadastro de atividade, aos talhões
e ao financeiro, respeitando o perfil da conta. O atalho de insumos informa que
essa função ainda não está disponível. O acesso à fila de sincronização continua
na tela inicial. A prévia de atividades usa os dados remotos da sessão e não é
afetada pela pesquisa aplicada anteriormente na lista.

Para entrar, informe a origem **HTTPS** do backend, sem `/api`, e as credenciais.
O Flask consultado serve HTTP na porta 5000: é necessário um proxy HTTPS com
certificado confiável pelo dispositivo. Apenas em builds de desenvolvimento, é
possível habilitar explicitamente HTTP local para testes, em `localhost`,
`127.0.0.1` ou `10.0.2.2` (host do emulador Android); senha e token trafegam
sem criptografia, portanto use somente credenciais de teste. A opção não existe
em builds de produção. A sessão fica somente em memória; após
fechar o app é necessário entrar novamente, inclusive antes de operar offline.
Os cadastros usados no formulário devem ser carregados com internet durante a
sessão atual. O usuário precisa estar vinculado a uma empresa.

Nas listas de propriedades e talhões, use **+ Nova propriedade** ou **+ Novo
talhão** para cadastrar no backend. O cadastro é somente online: não entra na
fila de atividades, e o formulário e o bloqueio de resultado incerto ficam
apenas em memória. Se um envio terminar sem confirmação, consulte a lista antes
de liberar outro envio; se fechar o aplicativo nessa situação, confira a lista
antes de cadastrar novamente. A propriedade exige nome, CAR, coordenadas e
áreas; o talhão exige uma propriedade da empresa, nome, código e área total.
Para salvar endereço, informe CEP, cidade e logradouro juntos.
No cadastro de propriedade, **Buscar CEP** consulta o ViaCEP diretamente pela
internet e envia apenas o CEP a esse serviço externo, sem credenciais do
backend. Confira as sugestões antes de salvar; se a consulta ou os catálogos
estiverem indisponíveis, preencha o endereço manualmente.

Para editar uma propriedade, toque no cartão na lista, altere os dados e use
**Salvar alterações**. A edição exige conexão e não entra na fila offline. O app
envia somente campos alterados; se o endereço mudar, envia CEP, cidade e
logradouro juntos. A alteração de endereço cria um novo logradouro no backend;
remover o endereço existente não é suportado. Se o salvamento não for confirmado,
consulte a propriedade na lista antes de tentar novamente. Se a atualização da
lista falhar após a confirmação, use a opção de atualizar a lista. Não há controle
de versão no backend: alterações simultâneas no mesmo campo podem se sobrescrever.

As atividades remotas são carregadas do backend e não têm cache persistente:
quando disponíveis somente em memória, são indicadas como possivelmente
desatualizadas. Para consultar seus detalhes, é necessário estar online. A lista
considera os vínculos entre atividade, talhão, propriedade e empresa; esse
filtro não substitui o isolamento no servidor.

Novas atividades planejadas são salvas no SQLite antes do envio e podem ser
sincronizadas automaticamente quando há conexão. A fila fica vinculada à conta
e à origem do servidor. Resultados incertos são bloqueados sem reenvio
automático; confira o backend antes de decidir como proceder. Após a confirmação,
o registro local permanece visível até a lista remota apresentar o mesmo ID.
Consulte o [núcleo de sincronização](src/app/sync/README.md) para mais detalhes.
A integração de atividades ainda precisa ser conferida com dados reais no
dispositivo; edição, exclusão, mudança de status e cadastro de insumos ou
máquinas em atividades não fazem parte desta etapa.

**Segurança:** no backend analisado, várias rotas de atividades, cadastros e
financeiro não exigem autenticação nem aplicam isolamento por empresa. Os filtros
do mobile não substituem autorização no servidor; não exponha essas rotas em
produção sem corrigir autenticação, permissões e isolamento no backend.
O banco local não é criptografado. As tarefas estão em [`openspec/`](openspec/).

Foi criado com [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
# safra-viva-frontmobile
