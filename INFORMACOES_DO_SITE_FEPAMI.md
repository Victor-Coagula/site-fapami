# Informações do site FEPAMI

Este documento descreve o site, seus recursos, como executá-lo e onde ficam os dados. Ele não contém senhas, chaves de sessão nem outros valores privados.

## Visão geral

O site da Federação Paulista de Artes Marciais Interestilos (FEPAMI) apresenta a instituição, divulga eventos e permite que professores autorizados atualizem o conteúdo por um painel administrativo. As fotos podem ser publicadas nas seções escolhidas, sem uma página pública de galeria.

O texto institucional e os contatos podem ser editados pelo painel. Revise e preencha as informações antes de divulgar o site publicamente.

## Seções do site

- **Início:** apresentação e frase de destaque.
- **Sobre:** nome e descrição da instituição.
- **Centro de Formação:** apresentação das atividades de formação.
- **Super Liga dos Campeões**
- **Festival de Artes Marciais**
- **Festival Lúdico de Artes Marciais**
- **Festival de Lutas Marciais**
- **Temático de Artes Marciais**
- **Criando Campeões:** propósito da FEPAMI.
- **Vencendo através do esporte:** atalho para a página inicial.
- **Fotos:** aparecem nas seções escolhidas no painel; não há opção Fotos no cabeçalho nem uma página pública de galeria.
- **Contato:** exibe os nomes e números de WhatsApp cadastrados (até cinco), o e-mail de contato e o Instagram.
- **Cabeçalho:** mantém todas as opções de navegação do site.
- **Página inicial:** mantém as seções de conteúdo abaixo do cabeçalho; não há atalhos duplicados acima do título principal.
- **Páginas de eventos:** Super Liga, festivais, Temático e Criando Campeões abrem páginas próprias pelo cabeçalho.
- **Acesso de Professores e Mestres:** abre uma página própria pelo cabeçalho; no campo de senha, o botão de olho mostra ou oculta o texto digitado.

As programações e fotos aparecem no site depois de cadastradas. As informações de endereços continuam disponíveis no painel administrativo, mas não são exibidas no site. Enquanto não houver registros de programação, as seções mostram mensagens informando que o conteúdo será divulgado em breve.

## Painel administrativo

Acesse **Acesso de Professores e Mestres** no cabeçalho e entre com seu usuário e senha. O botão de olho no campo de senha permite mostrar ou ocultar o que foi digitado. Depois de entrar, o painel oferece:

- **Dados do site:** editar nome, subtítulo, frase de destaque, descrição, até cinco contatos de WhatsApp com nome, e-mail e Instagram. Os botões “+” e “-” adicionam ou removem o último contato de WhatsApp.
- **Programação:** cada evento pode ser apenas informativo ou aceitar inscrições. Para inscrições, informe o prazo final e cadastre categorias com faixa etária e limite próprio. O formulário público solicita nome do aluno, professor/mestre, idade, faixa, telefone e e-mail.
- **Lista de eventos:** administradores veem todas as inscrições; cada professor/mestre vê a lista completa apenas dos eventos que cadastrou. Por padrão, somente administradores podem excluir inscrições. O administrador pode conceder essa permissão separadamente no Controle de acessos; exclusões só são permitidas antes do prazo e liberam a vaga da categoria.
- **Lista pública de inscritos:** só aparece depois do encerramento das inscrições e mostra o total, nome do aluno e categoria. Telefone, e-mail, idade, faixa e professor/mestre ficam restritos à organização e ao responsável pelo evento.
- **Endereços:** cadastrar unidade/professor, cidade, endereço, telefone, Instagram e observações.
- **Fotos por seção:** escolher a seção de destino, enviar e remover imagens; a descrição de cada foto é opcional.
- **Usuários:** administradores podem criar acessos, informar um telefone opcional e excluir acessos. O botão **Editar acesso** abre outra aba para alterar o login e o telefone de professores e administradores.
- **Controle de acessos:** aba exclusiva do administrador para liberar ou bloquear, por professor, as áreas Dados do site, Programação, Endereços e Fotos. O administrador também pode redefinir a senha do professor; essa operação invalida sessões existentes.
- **Senha:** apenas o administrador pode alterar a própria senha informando a senha atual. Professores dependem do administrador para redefinição; a operação invalida sessões existentes.

As senhas de novos usuários devem ter pelo menos 12 caracteres. O painel não exibe nem recupera senhas existentes.

## Tecnologias

- Node.js e Express para o servidor e a API.
- HTML, CSS e JavaScript no navegador.
- SQLite para conteúdo, eventos, categorias, inscrições, endereços, fotos, usuários e sessões.
- `better-sqlite3` para acesso ao banco; `bcryptjs` para proteger senhas.
- `express-session` com armazenamento de sessões em SQLite.
- `helmet` e limite de tentativas de login para proteções adicionais.

## Requisitos

- Node.js 18 ou superior, conforme o README do projeto. Node.js 22 foi usado para validar esta instalação e é recomendado para este projeto, especialmente por causa do módulo SQLite nativo.
- npm, incluído com Node.js.

## Executar no Windows

1. Abra a pasta do projeto no VS Code.
2. No terminal integrado, instale as dependências:

   ```powershell
   npm install
   ```

3. Crie o arquivo local `.env` copiando `.env.example` e preencha os valores. Não compartilhe nem publique o `.env`.
4. Inicie o site:

   ```powershell
   npm start
   ```

5. Abra [http://localhost:3000](http://localhost:3000) no Chrome.

Para desenvolvimento com reinício automático:

```powershell
npm run dev
```

Também é possível iniciar pelo VS Code: abra **Executar e Depurar** e selecione **FEPAMI - Iniciar site**. Esse perfil abre o navegador quando o servidor estiver pronto e pressupõe que o Node esteja instalado no caminho configurado no perfil.

Para parar o servidor iniciado no terminal, pressione `Ctrl+C` nesse terminal.

## Configurações locais

O arquivo `.env.example` lista as variáveis esperadas. Defina os valores no `.env` local:

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta HTTP; o padrão do projeto é `3000`. |
| `SESSION_SECRET` | Chave longa e aleatória usada para assinar sessões. |
| `ADMIN_USER` | Nome da conta administrativa inicial; se omitido, o padrão é `admin`. |
| `ADMIN_PASSWORD` | Senha inicial da conta administrativa. |
| `NODE_ENV` | Ambiente de execução; em produção use `production` e HTTPS. |

O usuário inicial é criado quando o banco ainda não tem usuários. Alterar `ADMIN_USER` ou `ADMIN_PASSWORD` depois que a conta já existe não altera automaticamente a conta armazenada no banco. Use o painel para trocar a senha.

## Dados e imagens

- Banco principal: `data/fepami.sqlite`.
- Sessões: arquivo SQLite na pasta `data/`.
- Imagens enviadas: `public/uploads/`.
- Formatos aceitos para envio: JPG, PNG, WEBP e GIF, até 5 MB por imagem.

Faça cópias de segurança da pasta `data/` e de `public/uploads/`. Para restaurar o site, mantenha os arquivos do banco e as imagens correspondentes juntos.

## API principal

As rotas são servidas pelo mesmo endereço do site:

| Método e rota | Uso |
| --- | --- |
| `GET /api/site` | Lê conteúdo público, programação, locais e fotos; após o prazo, eventos com inscrição incluem apenas nome e categoria dos alunos inscritos. |
| `GET /api/me` | Informa se a sessão atual está autenticada. |
| `POST /api/login` / `POST /api/logout` | Entrar e sair do painel. |
| `PUT /api/content` | Atualiza os dados institucionais; exige autenticação e permissão para Dados do site. |
| `POST /api/events`; `PUT`, `DELETE /api/events/:id` | Cria, edita e remove programação; exige autenticação e permissão para Programação. |
| `POST /api/events/:id/registrations` | Recebe inscrições públicas durante o prazo, valida categoria, faixa etária e limite de vagas. |
| `GET /api/registrations` | Lista dados completos de inscrições; exige autenticação e permissão para Programação. Administradores veem todos os eventos; professores veem os que cadastraram. |
| `DELETE /api/registrations/:id` | Exclui uma inscrição antes do prazo e libera sua vaga; exige administrador ou permissão específica concedida ao professor responsável. |
| `POST /api/locations`; `PUT`, `DELETE /api/locations/:id` | Cria, edita e remove locais; exige autenticação e permissão para Endereços. |
| `POST /api/upload?area=events` ou `?area=photos`; `POST /api/photos`; `PUT`, `DELETE /api/photos/:id` | Gerencia fotos; exige autenticação e permissão para a área correspondente. |
| `GET`, `POST /api/users`; `PUT`, `DELETE /api/users/:id` | Lista, cria, edita login/telefone e remove acessos; exige administrador. |
| `PUT /api/users/:id/permissions` | Altera permissões por área de um professor; exige administrador. |
| `PUT /api/users/:id/password` | Redefine a senha de um professor; exige administrador e invalida as sessões existentes. |
| `POST /api/change-password` | Altera a senha do administrador autenticado. |

## Estrutura do projeto

- `server.js`: servidor Express, autenticação, API e inicialização do SQLite.
- `public/index.html`: estrutura e seções da página.
- `public/styles.css`: estilos e layout responsivo.
- `public/site.js`: carregamento e interações da página inicial.
- `public/admin.html` e `public/admin.js`: página independente do painel administrativo e suas interações.
- `public/programacao.html` e `public/programacao.js`: páginas públicas dos eventos e formulários de inscrição.
- `public/admin-usuario.html` e `public/admin-usuario.js`: edição do login e telefone de professores e administradores em nova aba.
- `package.json` e `package-lock.json`: scripts e dependências do projeto.
- `.env.example`: nomes das configurações necessárias, sem credenciais reais.
- `.vscode/launch.json`: perfil de execução e depuração do VS Code.

## Publicação e segurança

O projeto está no repositório privado [Victor-Coagula/Fepami](https://github.com/Victor-Coagula/Fepami). Os arquivos locais de credenciais, banco, dependências instaladas e imagens enviadas não fazem parte do repositório.

Para hospedar na internet, escolha um serviço compatível com Node.js, configure as variáveis de ambiente no painel da hospedagem, habilite HTTPS e use armazenamento persistente para `data/` e `public/uploads/`. Não envie o `.env`, banco local ou fotos privadas para um repositório público.

Antes de publicar fotos de alunos, especialmente menores de idade, confira as autorizações necessárias. Revise também os textos, contatos e links institucionais.
