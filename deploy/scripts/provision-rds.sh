#!/usr/bin/env bash
# Cria RDS MySQL econômico (db.t4g.micro) para telemedicina + LIA.
# Região e VPC detectadas das EC2 em produção (us-east-2).
#
# Pré-requisito:
#   export AWS_ACCESS_KEY_ID=...
#   export AWS_SECRET_ACCESS_KEY=...
#   export AWS_DEFAULT_REGION=us-east-2
#
# Uso:
#   bash deploy/scripts/provision-rds.sh
#
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-2}"
VPC_ID="${VPC_ID:-vpc-08989ebd262310fbe}"
SG_TELEMEDICINA="${SG_TELEMEDICINA:-sg-0cf005d66ec24e69e}"
SG_LIA="${SG_LIA:-sg-062fd4bc9f6f6039c}"
DB_INSTANCE_ID="${DB_INSTANCE_ID:-crescere-shared}"
DB_SUBNET_GROUP="${DB_SUBNET_GROUP:-crescere-rds-subnets}"
RDS_SG_NAME="${RDS_SG_NAME:-rds-crescere-sg}"
DB_CLASS="${DB_CLASS:-db.t4g.micro}"
DB_NAME="${DB_NAME:-crescere_shared}"
MASTER_USER="${MASTER_USER:-crescere_admin}"
APP_USER="${APP_USER:-crescere_app}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Instale AWS CLI v2 e configure credenciais (aws configure)."
  exit 1
fi

aws sts get-caller-identity >/dev/null

if [[ -z "${RDS_MASTER_PASSWORD:-}" ]]; then
  RDS_MASTER_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  echo "RDS_MASTER_PASSWORD gerada (guarde): $RDS_MASTER_PASSWORD"
fi

if [[ -z "${RDS_APP_PASSWORD:-}" ]]; then
  RDS_APP_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  echo "RDS_APP_PASSWORD gerada (guarde): $RDS_APP_PASSWORD"
fi

CREDS_FILE="${CREDS_FILE:-/tmp/crescere-rds-credentials.env}"
cat > "$CREDS_FILE" <<EOF
RDS_HOST=PENDENTE_AGUARDE_AVAILABLE
RDS_MASTER_USER=$MASTER_USER
RDS_MASTER_PASSWORD=$RDS_MASTER_PASSWORD
RDS_USER=$APP_USER
RDS_PASSWORD=$RDS_APP_PASSWORD
RDS_DATABASE=$DB_NAME
AWS_REGION=$REGION
EOF
chmod 600 "$CREDS_FILE"
echo "Credenciais parciais em $CREDS_FILE"

echo "==> Buscando subnets da VPC $VPC_ID..."
mapfile -t SUBNETS < <(
  aws ec2 describe-subnets \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[*].SubnetId' \
    --output text | tr '\t' '\n' | sort -u
)

if ((${#SUBNETS[@]} < 2)); then
  echo "RDS exige pelo menos 2 subnets na VPC. Encontradas: ${#SUBNETS[@]}"
  exit 1
fi

echo "Subnets: ${SUBNETS[*]}"

echo "==> Security group RDS ($RDS_SG_NAME)..."
RDS_SG_ID="$(
  aws ec2 describe-security-groups \
    --region "$REGION" \
    --filters "Name=group-name,Values=$RDS_SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true
)"

if [[ -z "$RDS_SG_ID" || "$RDS_SG_ID" == "None" ]]; then
  RDS_SG_ID="$(
    aws ec2 create-security-group \
      --region "$REGION" \
      --group-name "$RDS_SG_NAME" \
      --description "MySQL RDS compartilhado telemedicina + LIA" \
      --vpc-id "$VPC_ID" \
      --query GroupId \
      --output text
  )"
  echo "Criado $RDS_SG_ID"
fi

for SRC_SG in "$SG_TELEMEDICINA" "$SG_LIA"; do
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$RDS_SG_ID" \
    --protocol tcp \
    --port 3306 \
    --source-group "$SRC_SG" 2>/dev/null || true
done

echo "==> DB subnet group ($DB_SUBNET_GROUP)..."
if ! aws rds describe-db-subnet-groups \
  --region "$REGION" \
  --db-subnet-group-name "$DB_SUBNET_GROUP" >/dev/null 2>&1; then
  aws rds create-db-subnet-group \
    --region "$REGION" \
    --db-subnet-group-name "$DB_SUBNET_GROUP" \
    --db-subnet-group-description "Subnets RDS Crescere" \
    --subnet-ids "${SUBNETS[@]}"
fi

ENGINE_VERSION="$(
  aws rds describe-db-engine-versions \
    --region "$REGION" \
    --engine mysql \
    --query 'DBEngineVersions[*].EngineVersion' \
    --output text | tr '\t' '\n' | grep '^8\.4' | sort -V | tail -1
)"
[[ -z "$ENGINE_VERSION" ]] && ENGINE_VERSION="8.4.10"

echo "==> Criando RDS $DB_INSTANCE_ID ($DB_CLASS, MySQL $ENGINE_VERSION)..."
if aws rds describe-db-instances \
  --region "$REGION" \
  --db-instance-identifier "$DB_INSTANCE_ID" >/dev/null 2>&1; then
  echo "Instância $DB_INSTANCE_ID já existe."
else
  aws rds create-db-instance \
    --region "$REGION" \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --db-instance-class "$DB_CLASS" \
    --engine mysql \
    --engine-version "$ENGINE_VERSION" \
    --master-username "$MASTER_USER" \
    --master-user-password "$RDS_MASTER_PASSWORD" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --db-name "$DB_NAME" \
    --vpc-security-group-ids "$RDS_SG_ID" \
    --db-subnet-group-name "$DB_SUBNET_GROUP" \
    --backup-retention-period 7 \
    --no-publicly-accessible \
    --storage-encrypted \
    --deletion-protection \
    --no-multi-az
fi

echo "==> Aguardando RDS ficar available (5–15 min)..."
aws rds wait db-instance-available \
  --region "$REGION" \
  --db-instance-identifier "$DB_INSTANCE_ID"

RDS_HOST="$(
  aws rds describe-db-instances \
    --region "$REGION" \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text
)"

sed -i "s|^RDS_HOST=.*|RDS_HOST=$RDS_HOST|" "$CREDS_FILE"
echo "Endpoint: $RDS_HOST"

echo "==> Criando usuário da aplicação..."
mysql -h "$RDS_HOST" -u "$MASTER_USER" -p"$RDS_MASTER_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS '${APP_USER}'@'%' IDENTIFIED BY '${RDS_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${APP_USER}'@'%';
FLUSH PRIVILEGES;
SQL

echo "==> RDS pronto."
echo "Próximo passo (telemedicina EC2):"
echo "  export RDS_HOST=$RDS_HOST RDS_USER=$APP_USER RDS_PASSWORD='$RDS_APP_PASSWORD' RDS_DATABASE=$DB_NAME"
echo "  bash deploy/scripts/migrate-mysql-to-rds.sh"
