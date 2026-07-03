# Checklist AWS Console — RDS MySQL compartilhado

Passo a passo para criar o RDS usado pela **telemedicina** (`crescere.life`) e pela **LIA** (`lia.crescere.life`).

Documentação relacionada:
- Migração completa: [RDS-MIGRATION.md](./RDS-MIGRATION.md)
- Script de dump/import: [scripts/migrate-mysql-to-rds.sh](./scripts/migrate-mysql-to-rds.sh)
- Corrigir tenant duplicado: [scripts/fix-duplicate-crescere-company.sql](./scripts/fix-duplicate-crescere-company.sql)

---

## Pré-requisitos

- [ ] Acesso ao Console AWS (região **us-east-2**, onde estão as EC2)
- [ ] EC2 **LIA**: `18.191.145.116` (IP privado `172.31.41.137`)
- [ ] EC2 **telemedicina**: `3.14.83.237` (IP privado `172.31.43.2`)
- [ ] Backup do MySQL atual (dump) antes de qualquer cutover
- [ ] Janela de manutenção (~30–60 min de indisponibilidade mínima se fizer dump com site no ar)

---

## Passo 1 — Identificar VPC e Security Groups das EC2

1. Console AWS → **EC2** → **Instances**
2. Selecione a instância **LIA** → aba **Networking**
3. Anote:
   - [ ] **VPC ID** (ex.: `vpc-0abc123...`)
   - [ ] **Subnet** (ex.: `subnet-0def456...`)
   - [ ] **Security groups** (ex.: `sg-lia-xxxxx`)
4. Repita para a instância **telemedicina**
5. Confirme que **ambas estão na mesma VPC**

| Instância | IP público | IP privado | VPC | Security Group |
|-----------|------------|------------|-----|----------------|
| LIA | 18.191.145.116 | 172.31.41.137 | | |
| telemedicina | 3.14.83.237 | 172.31.43.2 | | |

Se as VPCs forem diferentes, pare aqui — será necessário VPC peering ou recriar instâncias na mesma VPC.

---

## Passo 2 — Criar Security Group do RDS

1. **VPC** → **Security Groups** → **Create security group**
2. Configuração:
   - [ ] **Name:** `rds-crescere-sg`
   - [ ] **Description:** `MySQL RDS compartilhado telemedicina + LIA`
   - [ ] **VPC:** mesma VPC das EC2 (passo 1)
3. **Inbound rules** (adicione duas regras):

| Type | Port | Source | Descrição |
|------|------|--------|-----------|
| MySQL/Aurora | 3306 | `sg-XXXX` da EC2 telemedicina | Laravel |
| MySQL/Aurora | 3306 | `sg-YYYY` da EC2 LIA | Express LIA |

4. **Outbound:** deixe o padrão (All traffic → 0.0.0.0/0)
5. [ ] **Create security group**

Não adicione regra `0.0.0.0/0` na porta 3306.

---

## Passo 3 — Criar subnet group (se não existir)

1. **RDS** → **Subnet groups** → **Create DB subnet group**
2. [ ] **Name:** `crescere-rds-subnets`
3. [ ] **VPC:** mesma das EC2
4. [ ] Selecione **pelo menos 2 subnets** em AZs diferentes (requisito RDS)
5. [ ] **Create**

Se já existir um subnet group na VPC correta, pode reutilizar.

---

## Passo 4 — Criar instância RDS

1. **RDS** → **Databases** → **Create database**
2. **Engine options**
   - [ ] Engine type: **MySQL**
   - [ ] Version: **8.4.x** (ou 8.0.x se 8.4 não estiver disponível na região)
3. **Templates**
   - [ ] **Production** (recomendado) ou Free tier (só testes)
4. **Settings**
   - [ ] DB instance identifier: `crescere-shared`
   - [ ] Master username: `crescere_admin`
   - [ ] Master password: *(senha forte — guarde no gerenciador de senhas)*
5. **Instance configuration**
   - [ ] Class: `db.t4g.micro` (início) ou `db.t4g.small` se houver carga
6. **Storage**
   - [ ] Type: **gp3**
   - [ ] Allocated: **20 GB** (mínimo; aumente se o dump for grande)
   - [ ] Enable storage autoscaling: opcional (recomendado)
7. **Connectivity**
   - [ ] **Compute resource:** Don't connect to an EC2 compute resource
   - [ ] **Network type:** IPv4
   - [ ] **VPC:** mesma das EC2
   - [ ] **DB subnet group:** `crescere-rds-subnets` (passo 3)
   - [ ] **Public access:** **No**
   - [ ] **VPC security group:** escolha **existing** → `rds-crescere-sg`
   - [ ] **Availability Zone:** No preference (ou mesma AZ da EC2 telemedicina para latência)
8. **Database authentication**
   - [ ] Password authentication
9. **Additional configuration**
   - [ ] Initial database name: `crescere_shared`
   - [ ] DB parameter group: default
   - [ ] Option group: default
   - [ ] **Backup:** Enable automated backups
   - [ ] Backup retention: **7 days** (mínimo recomendado)
   - [ ] Copy tags to snapshots: yes
   - [ ] **Encryption:** Enable (default AWS key é suficiente)
   - [ ] **Deletion protection:** Enable (evita apagar por engano)
10. [ ] **Create database**

Aguarde status **Available** (5–15 min).

---

## Passo 5 — Anotar endpoint e testar conectividade

1. Na instância RDS criada, copie o **Endpoint**:
   - [ ] `crescere-shared.xxxxxxxxx.us-east-2.rds.amazonaws.com`
2. Na EC2 **telemedicina** (SSH):

```bash
# Instalar cliente se necessário
sudo apt-get install -y mysql-client

mysql -h crescere-shared.xxxxxxxxx.us-east-2.rds.amazonaws.com \
  -u crescere_admin -p
```

3. [ ] Conexão OK (sem timeout)

Se falhar com timeout:
- Verifique SG do RDS (passo 2)
- Verifique se a EC2 está na mesma VPC
- Verifique NACL da subnet (geralmente padrão permite)

---

## Passo 6 — Criar usuário da aplicação

No cliente MySQL conectado ao RDS:

```sql
CREATE DATABASE IF NOT EXISTS crescere_shared
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'crescere_app'@'%' IDENTIFIED BY 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON crescere_shared.* TO 'crescere_app'@'%';
FLUSH PRIVILEGES;
```

- [ ] Usuário `crescere_app` criado
- [ ] Senha anotada com segurança

Teste com o usuário app:

```bash
mysql -h ENDPOINT -u crescere_app -p crescere_shared -e "SELECT 1;"
```

---

## Passo 7 — Migrar dados do Docker

Na EC2 **telemedicina**:

```bash
cd ~/telemedicina/back

# Dump do MySQL Docker
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
    --single-transaction --routines --triggers' \
  > /tmp/crescere_dump_$(date +%Y%m%d).sql

# Import no RDS
mysql -h ENDPOINT -u crescere_app -p crescere_shared < /tmp/crescere_dump_YYYYMMDD.sql
```

- [ ] Dump gerado (verifique tamanho: `ls -lh /tmp/crescere_dump_*.sql`)
- [ ] Import concluído sem erro
- [ ] Tabelas presentes: `SHOW TABLES LIKE 'companies';`
- [ ] Tabelas LIA: `SHOW TABLES LIKE 'lia_%';`

Opcional — corrigir tenant duplicado **antes** do cutover:

```bash
mysql -h ENDPOINT -u crescere_app -p crescere_shared \
  < ~/crescere_lia/deploy/scripts/fix-duplicate-crescere-company.sql
```

---

## Passo 8 — Cutover telemedicina

1. Edite `~/telemedicina/back/.env`:

```env
DB_HOST=crescere-shared.xxxxxxxxx.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=crescere_shared
DB_USERNAME=crescere_app
DB_PASSWORD=SENHA_FORTE_AQUI
```

2. [ ] Recrie containers (sem depender do MySQL Docker):

```bash
cd ~/telemedicina/back
docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate web horizon scheduler
```

3. [ ] Teste https://crescere.life — login, pacientes, agenda
4. [ ] `php artisan migrate --force` (se necessário)

---

## Passo 9 — Cutover LIA

1. Edite `~/crescere_lia/.env.production` na EC2 LIA (mesmo RDS):

```env
DB_HOST=crescere-shared.xxxxxxxxx.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=crescere_shared
DB_USERNAME=crescere_app
DB_PASSWORD=SENHA_FORTE_AQUI
DEFAULT_TENANT_SLUG=crescere
```

2. [ ] Remova túnel SSH (não é mais necessário):

```bash
sudo systemctl disable --now lia-mysql-tunnel.service 2>/dev/null || true
fuser -k 3307/tcp 2>/dev/null || true
```

3. [ ] Deploy LIA:

```bash
cd ~/crescere_lia
BRANCH=feat/mysql-telemedicina ./deploy/update.sh
```

4. [ ] Log: `[db] MySQL conectado (crescere_shared@...)`
5. [ ] https://lia.crescere.life/admin — login e tenants

Teste de conectividade LIA → RDS (na EC2 LIA):

```bash
mysql -h ENDPOINT -u crescere_app -p crescere_shared -e "SELECT slug FROM companies WHERE slug='crescere';"
```

---

## Passo 10 — Descomissionar MySQL Docker (após validação)

Aguarde **7–14 dias** com RDS estável antes de remover o volume.

- [ ] Pare o container: `docker compose -f deploy/docker-compose.prod.yml stop db`
- [ ] Mantenha volume `dbdata` como backup frio
- [ ] Snapshot manual do volume ou dump adicional
- [ ] Depois: remova serviço `db` do `docker-compose.prod.yml` (commit separado)

---

## Passo 11 — Validação final

| Teste | Como verificar | OK |
|-------|----------------|-----|
| Telemedicina login | https://crescere.life | [ ] |
| Pacientes / agenda | Navegar no app | [ ] |
| LIA health | `curl -sk https://lia.crescere.life/api/health` | [ ] |
| LIA admin | https://lia.crescere.life/admin | [ ] |
| Tenant único | `SELECT id, slug FROM companies WHERE slug='crescere'` → 1 linha | [ ] |
| Backup RDS | RDS → Automated backups visível | [ ] |
| Sem túnel SSH | `ss -tlnp \| grep 3307` na LIA → vazio | [ ] |

---

## Rollback rápido

Se algo falhar após cutover:

1. **Telemedicina:** volte `.env` com `DB_HOST=db` e `docker compose up -d db web horizon scheduler`
2. **LIA:** volte túnel SSH ou `DB_HOST=host.docker.internal` + porta 3307
3. Restaure dump local se o RDS estiver corrompido

Mantenha `/tmp/crescere_dump_*.sql` até estabilizar.

---

## Custo estimado (us-east-2)

| Item | Valor aproximado |
|------|------------------|
| `db.t4g.micro` single-AZ | US$ 12–18/mês |
| Storage gp3 20 GB | US$ 2–3/mês |
| Backups (dentro da retenção) | incluso |
| **Total** | **~US$ 15–25/mês** |

Multi-AZ dobra o custo de compute — use só se precisar de alta disponibilidade.
