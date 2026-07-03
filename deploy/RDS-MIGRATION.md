# Banco compartilhado (RDS) — Telemedicina + LIA

Um **único MySQL na AWS (RDS)** usado pelos dois sistemas. Os dados ficam fora do Docker das EC2, com backup automático.

**Guias complementares:**
- [Checklist passo a passo no Console AWS](./RDS-AWS-CONSOLE-CHECKLIST.md)
- [Corrigir tenant duplicado `company-1` / `crescere`](./scripts/fix-duplicate-crescere-company.sql)
- Template `.env` telemedicina: `telemedicina/back/deploy/env.prod.example`

## Arquitetura

```
                    ┌─────────────────────────────┐
                    │   Amazon RDS (MySQL 8.4)    │
                    │   banco: crescere_shared    │
                    │                             │
                    │  companies                  │
                    │  lia_openai_config          │
                    │  lia_prompt_config          │
                    │  + tabelas do iClinica      │
                    └──────────────┬──────────────┘
                                   │ porta 3306
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     EC2 telemedicina       EC2 LIA (lia.crescere.life)
     crescere.life           back Docker
     Laravel (web)           Express
     Redis (continua Docker)  sem túnel SSH
```

## 1. Criar o RDS no Console AWS

Siga o checklist detalhado: **[RDS-AWS-CONSOLE-CHECKLIST.md](./RDS-AWS-CONSOLE-CHECKLIST.md)** (passos 1–6).

Resumo:
2. **Engine:** MySQL 8.4
3. **Template:** Free tier (dev) ou Production (recomendado em produção)
4. **DB instance identifier:** `crescere-shared`
5. **Master username:** `crescere_admin`
6. **Master password:** senha forte (guarde)
7. **Instance class:** `db.t4g.micro` (ou maior conforme carga)
8. **Storage:** gp3, 20 GB+
9. **Connectivity:**
   - **VPC:** mesma VPC das EC2 LIA e telemedicina
   - **Public access:** **No**
   - **VPC security group:** crie `rds-crescere-sg`
10. **Database name:** `crescere_shared` (opcional na criação; pode criar depois)
11. **Backup:** habilitado, retenção 7 dias (mínimo recomendado)
12. Criar

Anote o **endpoint**: ex. `crescere-shared.xxxxx.us-east-2.rds.amazonaws.com`

## 2. Security Groups

No security group **`rds-crescere-sg`** (RDS), inbound:

| Tipo | Porta | Origem |
|------|-------|--------|
| MySQL/Aurora | 3306 | Security group da EC2 **telemedicina** |
| MySQL/Aurora | 3306 | Security group da EC2 **LIA** |

Não libere `3306` para `0.0.0.0/0`.

## 3. Usuário do banco (após criar RDS)

Conecte uma vez como master (de uma EC2 na mesma VPC):

```bash
mysql -h SEU-RDS-ENDPOINT -u crescere_admin -p
```

```sql
CREATE DATABASE IF NOT EXISTS crescere_shared
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'crescere_app'@'%' IDENTIFIED BY 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON crescere_shared.* TO 'crescere_app'@'%';
FLUSH PRIVILEGES;
```

## 4. Migrar dados do Docker (telemedicina EC2)

Na EC2 do **telemedicina**:

```bash
cd ~/telemedicina/back
bash /caminho/para/migrate-mysql-to-rds.sh
```

Ou manualmente:

```bash
# Exportar do Docker
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" --single-transaction --routines --triggers' \
  > /tmp/crescere_dump.sql

# Importar no RDS
mysql -h SEU-RDS-ENDPOINT -u crescere_app -p crescere_shared < /tmp/crescere_dump.sql
```

Se o banco antigo se chama `iclinica`, o dump importa as tabelas para `crescere_shared`.

## 5. Configurar telemedicina

Edite `~/telemedicina/back/.env`:

```env
DB_CONNECTION=mysql
DB_HOST=crescere-shared.xxxxx.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=crescere_shared
DB_USERNAME=crescere_app
DB_PASSWORD=SENHA_FORTE_AQUI
```

Recrie os containers (sem depender do MySQL Docker):

```bash
cd ~/telemedicina/back
docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate web horizon scheduler
```

Teste o site https://crescere.life

**Opcional:** pare o container `db` do Docker (só depois de validar):

```bash
docker compose -f deploy/docker-compose.prod.yml stop db
```

## 6. Configurar LIA

Edite `~/crescere_lia/.env.production` na EC2 da LIA:

```env
DB_HOST=crescere-shared.xxxxx.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=crescere_shared
DB_USERNAME=crescere_app
DB_PASSWORD=SENHA_FORTE_AQUI
```

Remova o túnel SSH (não é mais necessário):

```bash
sudo systemctl disable --now lia-mysql-tunnel.service 2>/dev/null || true
pkill -f "3307:127.0.0.1:3306" || true
```

Deploy:

```bash
cd ~/crescere_lia
BRANCH=feat/mysql-telemedicina ./deploy/update.sh
```

Confirme no log: `[db] MySQL conectado (crescere_shared@...)`

## 7. Migrations

**Telemedicina** (tabelas iClinica + LIA):

```bash
cd ~/telemedicina/back
docker compose -f deploy/docker-compose.prod.yml exec web php artisan migrate --force
```

A LIA não roda migrations Laravel; usa as tabelas `lia_*` e `companies` já criadas pelo telemedicina.

## 8. Validação

| Teste | Comando / URL |
|-------|----------------|
| LIA health | `curl -sk https://lia.crescere.life/api/health` |
| LIA admin | https://lia.crescere.life/admin |
| Telemedicina | login em https://crescere.life |
| Mesma empresa | `slug=crescere` em ambos |

## Tabelas compartilhadas (LIA ↔ telemedicina)

| Tabela | Quem escreve | Uso |
|--------|--------------|-----|
| `companies` | telemedicina (+ LIA admin cria tenant) | empresas / whitelabel |
| `lia_openai_config` | LIA admin | chave OpenAI por empresa |
| `lia_prompt_config` | LIA admin | prompt por empresa |

## Custo estimado

- `db.t4g.micro` single-AZ: ~US$ 15–25/mês
- Backups inclusos na retenção configurada
- Sem custo de túnel SSH nem MySQL duplicado em duas EC2

## Rollback

Se precisar voltar ao MySQL Docker temporariamente:

1. Reative `db` no docker-compose do telemedicina
2. Restaure `.env` com `DB_HOST=db`
3. Na LIA, volte túnel ou aponte para IP privado do telemedicina

Mantenha o dump `/tmp/crescere_dump.sql` até estar estável no RDS.
