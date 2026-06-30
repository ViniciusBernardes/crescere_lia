# Deploy na AWS (EC2) — Crescere LIA

Guia para publicar em **lia.crescere.life** (EC2 `18.191.145.116`).

## Arquitetura

```
Internet → EC2 (portas 80/443)
              └── Caddy (HTTPS)
                    └── front (Nginx + React build)
                          └── /api → back (Express)
```

## 1. Pré-requisitos na AWS

### Security Group da EC2

Libere:

| Porta | Origem    | Uso        |
|-------|-----------|------------|
| 22    | Seu IP    | SSH        |
| 80    | 0.0.0.0/0 | HTTP       |
| 443   | 0.0.0.0/0 | HTTPS      |

### DNS

Registro **A** no provedor do domínio `crescere.life`:

```
lia.crescere.life  →  A  →  18.191.145.116
```

Aguarde a propagação (alguns minutos). Confira com:

```bash
dig +short lia.crescere.life
# deve retornar: 18.191.145.116
```

## 2. Preparar a instância (Ubuntu)

Conecte via SSH:

```bash
ssh -i sua-chave.pem ubuntu@18.191.145.116
```

Instale Docker:

```bash
sudo bash deploy/install-docker.sh
newgrp docker
```

## 3. Clonar o projeto

```bash
git clone https://github.com/ViniciusBernardes/crescere_lia.git
cd crescere_lia
git checkout Feat_02
```

## 4. Configurar variáveis

```bash
cp deploy/.env.production.example .env.production
nano .env.production
```

Exemplo (já configurado no repositório):

```env
DOMAIN=lia.crescere.life
```

## 5. Subir a aplicação

```bash
chmod +x deploy/deploy.sh deploy/update.sh
./deploy/deploy.sh
```

Acesse: **https://lia.crescere.life**

Health check: **https://lia.crescere.life/api/health**

## 6. Atualizar depois de mudanças no código

Na instância:

```bash
./deploy/update.sh
```

Ou manualmente:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Comandos úteis

```bash
# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Parar
docker compose -f docker-compose.prod.yml down

# Status dos containers
docker compose -f docker-compose.prod.yml ps
```

## Solução de problemas

### Certificado HTTPS não emite

- Confirme que o DNS aponta para o IP correto da EC2
- Portas 80 e 443 abertas no Security Group
- Nenhum outro serviço usando 80/443 na instância

### Página em branco

```bash
docker compose -f docker-compose.prod.yml logs front
```

### API não responde

```bash
docker compose -f docker-compose.prod.yml logs back
curl http://localhost/api/health
```

## Observações

- O front é buildado em modo produção (`npm run build`) dentro do Docker.
- O backend hoje expõe apenas `/api/health`; novas rotas devem usar o prefixo `/api`.
- Coloque assets estáticos (ex.: `lia.jpeg`) em `front/public/` antes do build.
