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

Ou sem Docker:

```bash
cd back && npm install && npm run dev
cd front && npm install && npm run dev
```

## Deploy na AWS

Veja o guia completo: [deploy/DEPLOY.md](deploy/DEPLOY.md)

Resumo na EC2:

```bash
cp deploy/.env.production.example .env.production
# edite DOMAIN=lia.crescere.life (se necessário)
./deploy/deploy.sh
```
