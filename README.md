# Crescere LIA

Plataforma de apoio a cuidadores de crianças com TEA — assistente virtual **Lia**.

## Estrutura

- `front/` — React + Vite + TypeScript
- `back/` — Express + TypeScript
- `deploy/` — scripts e configuração para produção (AWS)

## Desenvolvimento local

```bash
docker compose up
```

- Front (Docker): http://localhost:8081
- Front (`npm run dev`): http://localhost:8080
- Back (Docker local): http://localhost:3001/api/health
- Back (`npm run dev`): http://localhost:3000/api/health

Produção (AWS): **porta 80/443** — sem alteração (`docker-compose.prod.yml`).

### Se não abrir / erro de conexão

A LIA **depende do MySQL do telemedicina**. Se o back não subir:

```bash
# 1. MySQL
cd ~/Documentos/telemedicina && docker compose up -d mysql

# 2. Migrations (primeira vez ou após atualizar)
cd ~/Documentos/telemedicina
docker compose up -d mysql redis
docker compose run --rm back php artisan migrate --force

# 3. LIA (sem Docker — recomendado para dev)
cd ~/Documentos/crescere_lia
npm run dev
```

**Porta 8080 ocupada?** Use Docker da LIA em http://localhost:8081 ou pare o processo na 8080.

**Porta 3000 ocupada?** Pare o Docker da LIA (`docker compose down`) antes de `npm run dev` no back.

Ou sem Docker (dois terminais ou um só na raiz):

```bash
cd back && npm install && cp .env.example .env   # ADMIN_TOKEN e CREDENTIALS_ENCRYPTION_KEY
cd front && npm install

# Opção A — um comando (raiz do projeto):
npm install
npm run dev

# Opção B — dois terminais:
cd back && npm run dev    # http://localhost:3000
cd front && npm run dev   # http://localhost:8080
```

Admin local: **http://localhost:8080/admin** (exige o back na porta 3000).

## Banco de dados (telemedicina / iClinica)

A LIA usa o **mesmo MySQL** do projeto `telemedicina`:

| Tabela | Uso |
|--------|-----|
| `companies` | Empresas (tenant) — campo `slug` identifica cada cliente |
| `lia_openai_config` | Credenciais OpenAI por empresa (`company_id`) |

### Preparar o banco

No projeto telemedicina, rode a migration:

```bash
cd ../telemedicina
docker compose up -d mysql redis
docker compose run --rm back php artisan migrate --force
```

Configure o `back/.env` da LIA com as mesmas credenciais (`DB_HOST`, `DB_DATABASE`, etc.).

## Integração OpenAI (whitelabel)

Cada **empresa** (`companies.slug`) pode ter sua própria chave OpenAI em `lia_openai_config`.

`OPENAI_API_KEY` no `.env` tem **prioridade** sobre o banco (útil em dev).

### Configurar

```bash
cp back/.env.example back/.env
# Ajuste DB_* para o MySQL do telemedicina
```

1. Suba o MySQL do telemedicina (`docker compose up -d` na pasta telemedicina)
2. Suba a LIA (`npm run dev` ou `docker compose up`)
3. Acesse **http://localhost:8080/admin**
4. Cadastre empresas ou use um `slug` existente em `companies`

No front de cada cliente, defina `VITE_TENANT_SLUG=identificador-da-empresa` no build.

O chat envia `X-Tenant-Slug` em cada requisição — a API usa a chave da empresa correspondente.

### Rotas admin

| Rota | Descrição |
|------|-----------|
| `GET /api/admin/tenants` | Listar empresas |
| `POST /api/admin/tenants` | Criar empresa |
| `GET /api/admin/tenants/:slug/openai` | Ler credenciais (mascaradas) |
| `PUT /api/admin/tenants/:slug/openai` | Salvar credenciais |

## Deploy na AWS

Veja o guia completo: [deploy/DEPLOY.md](deploy/DEPLOY.md)

Resumo na EC2:

```bash
cp deploy/.env.production.example .env.production
# edite DOMAIN e DB_* (mesmo MySQL do telemedicina em produção)
./deploy/deploy.sh
```
