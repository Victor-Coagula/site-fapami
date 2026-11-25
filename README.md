# Site da Federação Paulista de Artes Marciais Interestilos (FEPAMI)

Site responsivo com:
- Páginas próprias para Super Liga, festivais, Temático e Criando Campeões, acessíveis pelo cabeçalho.
- Acesso de Professores e Mestres em página própria, aberta pelo cabeçalho.
- Fotos exibidas nas seções escolhidas, sem uma página pública de galeria.
- Painel administrativo para professores autorizados.
- Cadastro e exclusão de programação.
- Cadastro de locais, endereços, telefones e Instagram.
- Upload e exclusão de fotos.
- Edição dos dados institucionais e alteração da senha do administrador.
- Cadastro de até cinco contatos de WhatsApp com nome e e-mail de contato.
- Banco SQLite local.

## Requisitos
Node.js 18 ou superior.

## Instalação
1. Extraia o ZIP.
2. Abra a pasta `fepami-site` no terminal.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Edite `.env` e defina uma senha forte e um segredo de sessão longo e aleatório.
6. Execute `npm start`.
7. Abra `http://localhost:3000`.

## Primeiro acesso administrativo
O usuário inicial é o valor de `ADMIN_USER` (padrão: `admin`) e a senha é o valor de `ADMIN_PASSWORD` definido no `.env`. Não existe senha padrão pública. Troque a senha após o primeiro acesso pelo painel.

## Cadastro de contas de professores
Entre como administrador, abra **Usuários** e preencha os dados da conta. O telefone é opcional. Em **Controle de acessos**, o administrador pode liberar áreas específicas e redefinir a senha de cada professor. A edição do login e do telefone abre em uma nova aba. Não compartilhe uma única senha entre todos.

## Inscrições em eventos
Ao cadastrar uma programação, escolha entre publicar apenas informações ou aceitar inscrições. Para inscrições, defina o prazo e as categorias (faixa etária e limite de vagas). A aba **Lista de eventos** mostra os dados completos ao administrador e ao professor/mestre responsável pelo evento. Por padrão, só o administrador pode excluir inscrições; ele pode autorizar essa ação ao professor no **Controle de acessos**. A exclusão só é permitida antes do prazo e libera a vaga da categoria. Após o prazo, a página pública mostra somente o total, o nome do aluno e a categoria; telefone, e-mail, idade, faixa e professor/mestre não são publicados.

## Upload de fotos
No painel **Acesso de Professores e Mestres**, abra **Fotos por seção**, escolha a seção de destino e envie a imagem. A descrição é opcional. JPG, PNG, WEBP e GIF de até 5 MB são aceitos. Fotos de programação também podem ser adicionadas no formulário de programação.

## Colocar na internet
Este é um projeto pronto para rodar localmente. Para publicar, contrate uma hospedagem que aceite Node.js, configure as variáveis do `.env` no painel da hospedagem, use HTTPS e configure backup persistente da pasta `data/` e `public/uploads/`. Não publique o arquivo `.env`. Em produção, configure `NODE_ENV=production`.

## Importante
- A foto enviada informa o nome FEPAMI e os títulos listados no site; textos explicativos e contatos devem ser revisados e preenchidos pelos responsáveis.
- O endereço `interestilos.com.br` foi identificado como anotação manuscrita na imagem e aparece apenas como campo inicial editável.
- Antes de divulgar o site, confira autorizações para publicar fotos de alunos, especialmente menores de idade, e obtenha autorização dos responsáveis quando necessário.
