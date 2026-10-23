# CRUD de usuários

Aplicação independente com API C# / ASP.NET Core 8, Entity Framework Core e frontend React 19 / Vite 6. SQLite foi escolhido para testes locais. Não há integração com o HUB IA ou com bancos corporativos.

## Funcionalidades

- Cadastrar, listar, consultar detalhes, editar e excluir usuários.
- Nome, e-mail, status ativo/inativo, identificador e data de cadastro.
- Busca por nome/e-mail e filtro por status na interface.
- Validação no servidor, e-mail único sem distinção de maiúsculas/minúsculas e confirmação de exclusão.
- Interface responsiva em português, tratamento de erros e persistência em arquivo SQLite.

## Executar localmente

Requisitos: SDK .NET 8 ou 9 com runtime ASP.NET Core 8; Node.js 20.10+ e npm. Esta versão usa .NET 8 para compatibilidade com o SDK instalado neste workspace.

Clone o repositório e entre na pasta do projeto:

```powershell
git clone https://github.com/victorbosco-ti/teste-crud.git
cd teste-crud
```

Na raiz do projeto (no workspace original, `D:\promarket\UsuariosCrud`):

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
dotnet restore backend/UsuariosCrud.Api.csproj
```

No primeiro terminal:

```powershell
.\scripts\start-api.ps1
```

No segundo terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Acesse **http://127.0.0.1:5173**. A API usa a porta definida por `ASPNETCORE_URLS`; o exemplo aponta para `5080`. O proxy Vite encaminha `/api` para `API_PROXY_TARGET`, configurado em `frontend/.env`. O script da API carrega `.env` sem sobrescrever variáveis já definidas no processo. `dotnet run` sozinho não carrega `.env` automaticamente.

Se o PowerShell bloquear scripts, defina as variáveis no terminal e execute a API diretamente:

```powershell
$env:ConnectionStrings__UsersDb = 'Data Source=users.db'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
cd backend
dotnet run --no-launch-profile
```

## Conexão e credenciais

| Variável | Onde é lida | Uso |
| --- | --- | --- |
| `ConnectionStrings__UsersDb` | API, somente ambiente do processo | String de conexão SQLite obrigatória; a API não tem valor padrão embutido |
| `ASPNETCORE_URLS` | ASP.NET Core | Endereço e porta de escuta |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET Core | Ambiente de execução; exemplo usa `Production` para mensagens de erro genéricas |
| `API_PROXY_TARGET` | Servidor Vite | Destino da API no desenvolvimento; não é incluído no JavaScript do navegador |

SQLite é um arquivo local e não usa usuário/senha. Não foram criadas credenciais artificiais. O caminho do arquivo é relativo ao diretório de execução da API; com `start-api.ps1`, `users.db` fica em `backend/`. O diretório pai precisa existir e permitir escrita. Para escolher outro banco de teste, altere a string no ambiente, por exemplo apontando para um caminho absoluto.

Os arquivos `.env`, bancos, logs de teste e dependências são ignorados no `.gitignore`; apenas exemplos sem segredos são versionáveis. Nenhuma string de conexão ou credencial vai para o frontend. Se futuramente for adotado banco com autenticação, seu provider e sua configuração deverão ser adaptados, mantendo as credenciais no ambiente do backend. Variáveis `VITE_*` são públicas e não devem conter segredos.

## API

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/health` | Saúde e conectividade do banco |
| GET | `/api/users` | Lista ordenada por nome e ID |
| GET | `/api/users/{id}` | Detalhes do usuário |
| POST | `/api/users` | Criação; `201` e cabeçalho `Location` |
| PUT | `/api/users/{id}` | Atualização completa; `200` |
| DELETE | `/api/users/{id}` | Exclusão física; `204` |

Corpo para criação/edição:

```json
{ "name": "Ana Souza", "email": "ana@example.com", "isActive": true }
```

Nome tem entre 2 e 120 caracteres; e-mail é obrigatório, válido e tem até 254 caracteres. Espaços nas extremidades são removidos e e-mail é armazenado em minúsculas. `isActive` omitido assume `true`. Campos de identificação e data são gerados no servidor. Erros de validação retornam `400`, e-mail duplicado `409` e usuário inexistente `404`. O índice único garante a regra de e-mail mesmo com requisições concorrentes.

## Build e testes

```powershell
dotnet build backend/UsuariosCrud.Api.csproj
node --test scripts/test-api.mjs
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de API iniciam sua própria instância em uma porta disponível e usam banco isolado em `.local/api-test-*`. Verificam CRUD, validação, duplicidade concorrente, persistência após reinício e recusa de inicialização sem configuração de conexão.

Os testes Playwright iniciam API na porta `5089` e frontend na `5179`, usam `.local/e2e.db` e removem os usuários criados por eles. Cobrem CRUD na interface, filtro, duplicidade, cancelamento da exclusão, layout móvel e recuperação de indisponibilidade. Alternativa ao download de Chromium: use `$env:PLAYWRIGHT_CHANNEL = 'chrome'` para o Chrome instalado. Capturas de conferência ficam em `.local/desktop.png` e `.local/mobile.png`.

## Pacote único para execução

Depois de `npm run build` no frontend:

```powershell
# Na raiz UsuariosCrud
dotnet publish backend/UsuariosCrud.Api.csproj -c Release -o .local/publish
# Defina as variáveis de ambiente antes de executar.
cd .local/publish
dotnet UsuariosCrud.Api.dll
```

O projeto inclui `frontend/dist` em `wwwroot` na publicação. Assim, API e React são servidos na mesma origem e não precisam de CORS. Sem o build do frontend, apenas a API é disponibilizada.

## Limites deste exemplo

O escopo é cadastro local para testes, sem login ou autorização; `isActive` é dado cadastral e não controla acesso. O banco é criado automaticamente por `EnsureCreated`, sem migrações de evolução de schema. A lista é carregada integralmente; busca e filtro são locais, sem paginação. Não há implantação externa realizada.

Arquitetura e contratos: [SDD do projeto](docs/SDD.md). Provider SQLite: [documentação oficial do EF Core](https://learn.microsoft.com/en-us/ef/core/providers/sqlite/).
