-- =============================================================================
-- Corrige duplicata companies: company-1 (id=1) vs crescere (id=2)
--
-- Contexto:
--   - id=1, slug=company-1  → empresa original do iClinica (dados reais)
--   - id=2, slug=crescere   → criada pela LIA (ensureDefaultTenant), geralmente vazia
--
-- Resultado esperado:
--   - Uma única empresa ativa com slug=crescere (id=1)
--   - Configs LIA (lia_openai_config, lia_prompt_config) na empresa canônica
--   - Empresa duplicata removida
--
-- Uso (na EC2 telemedicina, com backup antes):
--   docker compose -f deploy/docker-compose.prod.yml exec -T db \
--     mysql -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" \
--     < /caminho/fix-duplicate-crescere-company.sql
--
-- Ou via mysql client no RDS após migração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FASE 0 — Diagnóstico (somente leitura; revise antes de aplicar a FASE 1)
-- -----------------------------------------------------------------------------

SELECT '=== companies ===' AS section;
SELECT id, name, slug, active, created_at
FROM companies
WHERE slug IN ('company-1', 'crescere')
   OR id IN (1, 2)
ORDER BY id;

SELECT '=== contagem por empresa (dados iClinica) ===' AS section;
SELECT c.id, c.slug,
       (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users,
       (SELECT COUNT(*) FROM patients p WHERE p.company_id = c.id) AS patients,
       (SELECT COUNT(*) FROM events e WHERE e.company_id = c.id) AS events
FROM companies c
WHERE c.id IN (1, 2)
ORDER BY c.id;

SELECT '=== configs LIA ===' AS section;
SELECT 'lia_openai_config' AS tbl, company_id, LEFT(value, 40) AS value_preview, updated_at
FROM lia_openai_config
WHERE company_id IN (1, 2)
UNION ALL
SELECT 'lia_prompt_config', company_id, LEFT(system_prompt, 40), updated_at
FROM lia_prompt_config
WHERE company_id IN (1, 2);

-- Esperado antes do fix:
--   id=1 com users/patients/events > 0 e slug=company-1
--   id=2 com contagens zeradas e slug=crescere
-- Se id=2 tiver dados iClinica, PARE e revise manualmente.

-- -----------------------------------------------------------------------------
-- FASE 1 — Correção (execute só após validar o diagnóstico acima)
-- -----------------------------------------------------------------------------

START TRANSACTION;

-- Empresa canônica = id 1 (dados do iClinica). Duplicata LIA = id 2.
SET @canonical_id := 1;
SET @duplicate_id := 2;

-- Aborta se a duplicata tiver dados críticos do iClinica
SET @dup_users := (SELECT COUNT(*) FROM users WHERE company_id = @duplicate_id);
SET @dup_patients := (SELECT COUNT(*) FROM patients WHERE company_id = @duplicate_id);
SET @dup_events := (SELECT COUNT(*) FROM events WHERE company_id = @duplicate_id);

SELECT
  @duplicate_id AS duplicate_id,
  @dup_users AS duplicate_users,
  @dup_patients AS duplicate_patients,
  @dup_events AS duplicate_events,
  CASE
    WHEN @dup_users + @dup_patients + @dup_events > 0
    THEN 'ABORTAR: duplicata tem dados iClinica'
    ELSE 'OK para prosseguir'
  END AS status;

-- Força erro e interrompe o script se a duplicata tiver dados do iClinica
SELECT IF(
  @dup_users + @dup_patients + @dup_events > 0,
  (SELECT 1 / 0),
  1
) AS safety_check;

-- Copia OpenAI da duplicata → canônica (só se canônica não tiver)
INSERT INTO lia_openai_config (company_id, value, updated_at)
SELECT @canonical_id, d.value, d.updated_at
FROM lia_openai_config d
WHERE d.company_id = @duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM lia_openai_config c WHERE c.company_id = @canonical_id
  );

-- Copia prompt da duplicata → canônica (só se canônica não tiver)
INSERT INTO lia_prompt_config (company_id, system_prompt, updated_at)
SELECT @canonical_id, d.system_prompt, d.updated_at
FROM lia_prompt_config d
WHERE d.company_id = @duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM lia_prompt_config c WHERE c.company_id = @canonical_id
  );

-- Libera o slug 'crescere' (unique) antes de renomear a canônica
UPDATE companies
SET slug = CONCAT('removed-', id, '-', UNIX_TIMESTAMP()),
    active = 0,
    updated_at = NOW()
WHERE id = @duplicate_id
  AND @dup_users + @dup_patients + @dup_events = 0;

-- Atribui slug correto à empresa canônica
UPDATE companies
SET slug = 'crescere',
    active = 1,
    updated_at = NOW()
WHERE id = @canonical_id
  AND @dup_users + @dup_patients + @dup_events = 0;

-- Remove duplicata inativa (cascade apaga lia_* restantes dela)
DELETE FROM companies
WHERE id = @duplicate_id
  AND active = 0
  AND slug LIKE 'removed-%'
  AND @dup_users + @dup_patients + @dup_events = 0;

-- -----------------------------------------------------------------------------
-- FASE 2 — Validação pós-correção
-- -----------------------------------------------------------------------------

SELECT '=== resultado ===' AS section;
SELECT id, name, slug, active FROM companies WHERE slug = 'crescere';

SELECT 'lia_openai_config' AS tbl, company_id FROM lia_openai_config WHERE company_id = @canonical_id
UNION ALL
SELECT 'lia_prompt_config', company_id FROM lia_prompt_config WHERE company_id = @canonical_id;

SELECT COUNT(*) AS empresas_com_slug_crescere
FROM companies
WHERE slug = 'crescere' AND active = 1;
-- Deve retornar 1

-- Se tudo estiver correto:
COMMIT;
-- Se algo estiver errado:
-- ROLLBACK;
