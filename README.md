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

- Front: http://localhost:5173
- Back: http://localhost:3000/api/health

Ou sem Docker (dois terminais ou um só na raiz):

```bash
cd back && npm install && cp .env.example .env   # ADMIN_TOKEN e CREDENTIALS_ENCRYPTION_KEY
cd front && npm install

# Opção A — um comando (raiz do projeto):
npm install
npm run dev

# Opção B — dois terminais:
cd back && npm run dev    # http://localhost:3000
cd front && npm run dev   # http://localhost:5173
```

Admin local: **http://localhost:5173/admin** (exige o back na porta 3000).

## Integração OpenAI (whitelabel)

Cada **empresa (tenant)** tem sua própria chave OpenAI, **criptografada no banco** — nunca no `.env`.

Isso prepara o produto para **whitelabel**: cada cliente cadastra a chave dele no painel admin.

### Configurar

```bash
cp back/.env.example back/.env
# Defina ADMIN_TOKEN e CREDENTIALS_ENCRYPTION_KEY (openssl rand -hex 32)
```

1. Suba o projeto
2. Acesse **http://localhost:5173/admin**
3. Cadastre empresas e, para cada uma, a chave OpenAI

No front de cada cliente, defina `VITE_TENANT_SLUG=identificador-da-empresa` no build.

### Modelo de dados

| Tabela | Uso |
|--------|-----|
| `tenants` | Empresas do whitelabel (nome + slug) |
| `tenant_openai_config` | Credenciais OpenAI criptografadas por empresa |

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
# edite DOMAIN=lia.crescere.life (se necessário)
./deploy/deploy.sh
```
