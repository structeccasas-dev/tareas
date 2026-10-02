# Diseño: Módulo de Cobranzas, Cartera y Financiamiento

> Estado: **propuesta para revisión**. No se ha implementado nada todavía. Este documento
> cubre arquitectura, modelo de datos y motor financiero. Tras aprobación se pasa a código.

---

## 0. Decisiones clave (resumen ejecutivo)

1. **Módulo 100% independiente**: `src/modules/collections`, sin ninguna FK hacia `sales`,
   `projects` (el existente) ni ningún otro modelo del sistema actual.
2. **Colisión de nombres detectada**: ya existe una tabla `projects` (`src/db/schema/project.ts`)
   usada por el módulo de tareas internas (proyectos de trabajo, no inmuebles). Para no pisarla
   ni generar confusión, **todas las tablas nuevas llevan el prefijo `cob_`**
   (`cob_clients`, `cob_projects`, `cob_properties`, `cob_operations`, ...). Esto además deja
   explícito en la base de datos qué pertenece al módulo financiero.
3. **Inmueble histórico → Alternativa B, simplificada**: una sola tabla `cob_properties` sirve
   tanto para inmuebles del catálogo actual como para inmuebles históricos/referenciales,
   distinguidos por una columna `origin`. Se evita duplicar modelos y se evita ensuciar
   `cob_operations` con columnas `historical_*` que quedarían vacías en el 90% de los casos.
4. **No existe una tabla "payment_plans" única**: se modela como **versiones de plan**
   (`cob_payment_plan_versions`), porque una refinanciación o un recálculo por pago
   extraordinario **crean una nueva versión**, nunca modifican cuotas ya generadas. Esto da
   trazabilidad completa "gratis".
5. **Etapas (`cob_plan_stages`) dentro de una versión de plan**: cada etapa define su propio
   algoritmo (contado, cuotas fijas, francés, ...) vía un campo `stage_type` + una columna
   `config` (jsonb) como *escape hatch* para parámetros específicos del algoritmo, sin tener
   que migrar el esquema cada vez que se agregue una variante nueva.
6. **Cuota ≠ Pago, con tabla puente `cob_payment_allocations`**: un pago puede cubrir varias
   cuotas y una cuota puede recibir aportes de varios pagos.
7. **Ledger de auditoría propio (`cob_events`)**: no se reutiliza la tabla genérica
   `activity_log` existente (está tipada estrictamente a `entityType: "task"`); el módulo
   financiero necesita campos propios (saldo antes/después, montos, metadata estructurada).
8. **Nada se borra físicamente**: todo es cancelación lógica (`status`, `cancelled_at`,
   `cancelled_by`, `cancellation_reason`) + un evento en `cob_events`.
9. **Monedas explícitas, sin conversión automática**: cada operación tiene una moneda fija;
   un pago en otra moneda requiere tipo de cambio explícito y queda registrado como tal.

---

## A. Arquitectura general

### A.1 Alcance del módulo

Nuevo módulo de aplicación, siguiendo el patrón que ya usa el proyecto
(`src/modules/<dominio>/{data,actions,components}`):

```text
src/modules/collections/
  data/          -> queries de lectura (listados, estado de cuenta, dashboard)
  actions/       -> server actions (crear cliente, registrar pago, generar plan, etc.)
  engine/        -> motor financiero puro (sin acceso a DB): calculadoras de cronograma,
                    cálculo de mora, cálculo de liquidación anticipada
  components/    -> UI (tablas, formularios, vistas de operación/cliente)

src/db/schema/collections/
  client.ts
  project.ts
  property.ts
  operation.ts
  paymentPlanVersion.ts
  planStage.ts
  installment.ts
  payment.ts
  paymentAllocation.ts
  lateFeeConfiguration.ts
  currency.ts
  financialEvent.ts

src/app/(crm)/cobranzas/
  page.tsx                    -> dashboard
  clientes/page.tsx           -> listado de clientes
  clientes/[id]/page.tsx      -> ficha de cliente (operaciones, saldo, historial)
  operaciones/[id]/page.tsx   -> detalle de operación (cuotas, pagos, plan)
```

### A.2 Qué se reutiliza del sistema actual (y qué no)

Se reutiliza:
- `users` (staff interno) — para `created_by`, `registered_by`, `performed_by`, etc. Los
  **clientes del módulo financiero son una tabla nueva (`cob_clients`)**, sin relación con
  `users` ni con `personnel`.
- Infraestructura de sesión/permisos (`src/lib/session.ts`, `src/lib/permissions.ts`): se
  agrega una función `canManageCollections(session)` en vez de crear un sistema de roles
  paralelo.
- Componentes de UI genéricos (`Card`, `Table`-like, `Badge`, `StatTile`, `Dialog`, etc.) y
  layout del route group `(crm)`.
- El patrón de auditoría "no borrar, marcar cancelado" que ya usan `personnel_leaves` /
  `personnel_documents`.

No se reutiliza (a propósito):
- La tabla `projects` existente (es de otro dominio).
- `activity_log` (tipada a tareas; el ledger financiero necesita su propia forma).
- Cualquier noción de "venta". El módulo no sabe ni necesita saber cómo se vendió algo.

### A.3 Capas dentro del módulo

```text
UI (components) ──> actions (server actions, mutación) ──> engine (cálculo puro)
                              │                                    │
                              └──────────────> DB (drizzle) <──────┘
                       data (queries de lectura, para listados/dashboard)
```

El **motor financiero** (`engine/`) es deliberadamente independiente de la base de datos:
recibe parámetros (capital, tasa, plazo, fecha) y devuelve un cronograma o un cálculo de mora/
liquidación. Esto permite testearlo con unit tests puros y reutilizarlo tanto al generar un
plan nuevo como al simular "¿cuánto pagaría si...?" sin tocar la base de datos.

---

## B. Modelo de datos — diagrama ER

```text
cob_currencies
   │ (code)
   │
cob_clients                         cob_projects
   │  1                                │  1
   │                                   │
   │                                   ▼  N
   │                             cob_properties  (origin: catalog | historical)
   │                                   │  0..1
   │  N                                │
   ▼                                   ▼
cob_operations ───────────────────────┘   (operation.property_id nullable)
   │  1
   │
   ▼  N
cob_payment_plan_versions  (status: draft|active|superseded|cancelled)
   │  self-FK: replaces_version_id  (historial de refinanciaciones/recálculos)
   │  1
   ▼  N
cob_plan_stages  (stage_type: cash|fixed_installment|french|custom, sequence_number)
   │  1
   ▼  N
cob_installments  (status: pending|partial|paid|cancelled|refinanced [+ "vencida" derivada])
   │  N                                              ▲
   │                                                  │ N
   ▼  N                                               │
cob_payment_allocations ───────────────────────────── cob_payments (client_id, operation_id?)
                                                        │  1
                                                        ▼  N (opcional)
                                                    (adjunto/comprobante: ver §payments)

cob_events  (entity_type, entity_id, operation_id, event_type, balance_before/after, metadata)
   -> apunta lógicamente a cualquier entidad de arriba (no tiene FK físicas rígidas,
      ver justificación en la sección de la tabla).

cob_late_fee_configurations  (scope: global | project | operation, effective_from/to)
```

Notas sobre cardinalidades:

- `cob_clients 1—N cob_operations`: un cliente puede tener múltiples operaciones (caso 5).
- `cob_operations 0..1—N cob_properties`: **opcional**, exactamente como pide el punto 4.
- `cob_operations 1—N cob_payment_plan_versions`: normalmente 1 activa + N históricas
  (refinanciaciones/recálculos).
- `cob_payment_plan_versions 1—N cob_plan_stages`: mínimo 1 etapa siempre.
- `cob_plan_stages 1—N cob_installments`: 0 cuotas mientras la etapa está en `pending`
  (no generadas todavía).
- `cob_payments N—N cob_installments` a través de `cob_payment_allocations`.

---

## C. Tablas

Convención general (igual que el resto del proyecto): `id uuid default random() primary key`,
`created_at timestamp default now()`, montos en `numeric(14,2)` (o `numeric(6,4)` para tasas),
fechas de negocio en `date`, timestamps de eventos en `timestamp`. Los enums se implementan
como `varchar` + `$type<union>` de TypeScript (igual que `personnel.ts`), no como `pg enum`,
para que agregar un valor no requiera una migración de tipo.

### C.1 `cob_currencies`
Catálogo de monedas soportadas (evita hardcodear "USD/BOB" en el código).

| campo | tipo | notas |
|---|---|---|
| code (PK) | varchar(3) | ej. `USD`, `BOB` |
| name | varchar(100) | "Dólar estadounidense" |
| symbol | varchar(5) | `$`, `Bs` |
| decimal_places | smallint | default 2 |
| active | boolean | default true |

### C.2 `cob_clients`
Cliente del módulo financiero (independiente de `users`/`personnel`).

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| client_type | varchar(20) `'person'\|'company'` | sí | define qué campos aplican |
| first_name | varchar(150) | si es persona | |
| last_name | varchar(150) | si es persona | |
| business_name | varchar(255) | si es empresa | razón social |
| document_type | varchar(30) `'ci'\|'nit'\|'passport'\|'other'` | sí | |
| document_number | varchar(50) | sí | |
| email | varchar(255) | no | |
| phone | varchar(50) | no | |
| secondary_phone | varchar(50) | no | |
| address | text | no | |
| city | varchar(100) | no | |
| country | varchar(100) | no | |
| status | varchar(20) `'active'\|'inactive'\|'archived'` | sí, default `active` | |
| notes | text | no | |
| created_by | uuid → users.id | sí | |
| created_at / updated_at | timestamp | sí | |

Índices: único compuesto `(document_type, document_number)`; índice sobre `email`; índice de
texto sobre nombre/razón social para el buscador de clientes.

Campos adicionales útiles que agrego al mínimo pedido: `client_type` (persona vs. empresa,
frecuente en inmobiliarias), `secondary_phone`, `status`. Deliberadamente **no** agrego cosas
como "profesión" o "estado civil": no aportan a cobranza y son ruido de captura para
administración.

### C.3 `cob_projects`
Catálogo liviano de proyectos inmobiliarios (distinto del `projects` interno de tareas).

| campo | tipo | oblig. |
|---|---|---|
| id (PK) | uuid | sí |
| name | varchar(255) | sí |
| description | text | no |
| address / city / country | varchar/text | no |
| status | varchar(20) `'active'\|'inactive'\|'archived'` | sí, default `active` |
| created_by, created_at, updated_at | | sí |

### C.4 `cob_properties`
Inmueble — de catálogo actual **o** histórico/referencial. Ver decisión §0.3.

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| origin | varchar(20) `'catalog'\|'historical'` | sí | de dónde viene el dato |
| project_id | uuid → cob_projects.id, **nullable** | no | null si el proyecto ya no existe/no se registró |
| project_name_snapshot | varchar(255) | sí | nombre del proyecto tal cual se conoce (aunque `project_id` exista, queda como snapshot legible si el proyecto se renombra después) |
| unit_label | varchar(50) | sí | "502", "Dpto 302" |
| property_type | varchar(30) `'departamento'\|'casa'\|'oficina'\|'local'\|'terreno'\|'parqueo'\|'otro'` | no | |
| area_m2 | numeric(8,2) | no | |
| floor | varchar(20) | no | |
| description | text | no | |
| created_by, created_at, updated_at | | sí | |

Sin unicidad forzada en `(project_id, unit_label)`: puede haber datos históricos duplicados o
incompletos y no queremos que la carga administrativa falle por eso.

### C.5 `cob_operations`
**Entidad central**: la obligación financiera de un cliente.

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| operation_number | varchar(20) | sí, único | código legible, ej. `OP-000123` |
| client_id | uuid → cob_clients.id | sí | |
| property_id | uuid → cob_properties.id, nullable | no | `NULL` = sin inmueble asociado en absoluto |
| currency_code | varchar(3) → cob_currencies.code | sí | fija para toda la operación |
| original_amount | numeric(14,2) | sí | precio/monto original del compromiso |
| down_payment_amount | numeric(14,2) | no, default 0 | anticipo |
| financed_amount | numeric(14,2) | sí | capital que efectivamente se financia |
| current_balance | numeric(14,2) | sí, mantenido | **columna caché**: saldo de capital+interés+mora pendiente. Fuente de verdad real = cuotas; se recalcula en la misma transacción que registra pagos/genera cuotas. Nunca se edita a mano. |
| total_paid | numeric(14,2) | sí, mantenido | caché, idem |
| overdue_amount | numeric(14,2) | sí, mantenido | caché, idem |
| status | varchar(20) `'active'\|'completed'\|'refinanced'\|'cancelled'` | sí, default `active` | |
| start_date | date | sí | |
| external_reference | varchar(100) | no | para integración futura (§26): id en el sistema comercial |
| source | varchar(20) `'manual'\|'imported'` | sí, default `manual` | |
| notes | text | no | |
| created_by, created_at, updated_at | | sí | |
| cancelled_at / cancelled_by / cancellation_reason | timestamp/uuid/text | no | |

Índices: `client_id`, `status`, `operation_number` (único).

### C.6 `cob_payment_plan_versions`
Sustituye a un único "payment_plan": permite refinanciar/recalcular **sin perder historial**.

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| operation_id | uuid → cob_operations.id | sí | |
| version_number | smallint | sí | secuencial por operación (1, 2, 3...) |
| status | varchar(20) `'draft'\|'active'\|'superseded'\|'cancelled'` | sí | sólo una `active` por operación (constraint aplicado en la capa de servicio + índice único parcial) |
| reason | varchar(30) `'initial'\|'refinancing'\|'prepayment_recalculation'\|'restructuring'\|'correction'` | sí | |
| replaces_version_id | uuid → cob_payment_plan_versions.id, nullable (self-FK) | no | versión anterior que reemplaza |
| triggering_payment_id | uuid → cob_payments.id, nullable | no | si nació de un pago extraordinario |
| effective_date | date | sí | desde cuándo aplica |
| notes | text | no | motivo/acuerdo en lenguaje llano |
| created_by, created_at | | sí | |
| superseded_by, superseded_at | uuid/timestamp | no | quién/cuándo la reemplazó |

### C.7 `cob_plan_stages`
Etapas/tramos dentro de una versión de plan (§7, §14).

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| plan_version_id | uuid → cob_payment_plan_versions.id | sí | |
| sequence_number | smallint | sí | orden dentro del plan (1, 2, ...) |
| stage_type | varchar(30) `'cash'\|'fixed_installment'\|'french'\|'custom'` | sí | selecciona el algoritmo del motor |
| installments_count | smallint | no (null si `cash`) | |
| periodicity | varchar(20) `'weekly'\|'biweekly'\|'monthly'\|'quarterly'\|'annual'` | sí, default `monthly` | |
| interest_rate | numeric(8,5) | no | significado depende de `rate_type` |
| rate_type | varchar(20) `'none'\|'nominal_annual'\|'effective_annual'\|'monthly'` | sí, default `none` | |
| flat_fee_per_installment | numeric(14,2) | no, default 0 | cargo administrativo fijo por cuota, **independiente del interés** (ver §14: 0% interés ≠ 100% capital necesariamente) |
| grace_period_months | smallint | no, default 0 | |
| grace_period_type | varchar(20) `'total'\|'interest_only'` | no | sólo si `grace_period_months > 0` |
| balloon_amount | numeric(14,2) | no | cuota final/balloon, si aplica |
| config | jsonb | no | *escape hatch* para parámetros específicos de variantes futuras (cuotas variables, reglas custom) sin migrar el esquema |
| start_date / end_date | date | no, se calculan al generar | |
| status | varchar(20) `'pending'\|'generated'\|'active'\|'completed'\|'cancelled'` | sí, default `pending` | `pending` hasta que se generan las cuotas |
| created_by, created_at, updated_at | | sí | |

### C.8 `cob_installments`
Cuota — obligación generada por una etapa (§9, §13).

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| plan_version_id | uuid → cob_payment_plan_versions.id | sí | denormalizado para listar cuotas de una operación sin pasar por stage |
| stage_id | uuid → cob_plan_stages.id | sí | |
| installment_number | smallint | sí | correlativo dentro de la versión de plan |
| due_date | date | sí | |
| opening_balance | numeric(14,2) | sí | saldo de capital antes de esta cuota |
| principal_amount | numeric(14,2) | sí | |
| interest_amount | numeric(14,2) | sí, default 0 | |
| other_charges_amount | numeric(14,2) | sí, default 0 | |
| total_amount | numeric(14,2) | sí | principal + interés + cargos (monto original, sin mora) |
| closing_balance | numeric(14,2) | sí | saldo de capital después de esta cuota |
| late_fee_amount | numeric(14,2) | sí, default 0 | mora acumulada a la fecha, recalculada por el job/servicio de mora |
| paid_principal / paid_interest / paid_other / paid_late_fee | numeric(14,2) | sí, default 0 | a qué componente se aplicó lo pagado (trazabilidad) |
| paid_amount | numeric(14,2) | sí, default 0 | suma de los `paid_*` |
| balance_due | numeric(14,2) | sí, mantenido | `total_amount + late_fee_amount - paid_amount` |
| status | varchar(20) `'pending'\|'partial'\|'paid'\|'cancelled'\|'refinanced'` | sí, default `pending` | ver nota abajo sobre "vencida" |
| engine_metadata | jsonb | no | parámetros de cálculo usados (tasa aplicada, fracción de período, versión de fórmula) — refuerza auditabilidad para sistema francés |
| notes | text | no | |
| created_at, updated_at | | sí | |

**Nota sobre "VENCIDA"**: no se modela como un valor más de `status` que alguien deba setear a
mano (eso se desincroniza con la fecha real). Se calcula: *vencida = `due_date < hoy` AND
`status IN ('pending','partial')`*. Se expone como un campo derivado en las queries de lectura
(`data/`) y en el dashboard, calculado siempre con la misma función helper, para que nunca haya
dos lugares del código con criterios distintos de qué es mora. Este es el único punto donde me
aparto literalmente de la lista del punto 9 — lo explico en la sección E.4.

Índices: `plan_version_id`, `due_date`, `status`.

### C.9 `cob_payments`
Pago recibido (§10, §11, §19).

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| client_id | uuid → cob_clients.id | sí | |
| operation_id | uuid → cob_operations.id, nullable | no | denormalizado para el caso común (pago de una sola operación); la fuente de verdad de a qué cuotas se aplicó es `cob_payment_allocations` |
| payment_category | varchar(20) `'regular'\|'extraordinary'\|'down_payment'\|'settlement'` | sí, default `regular` | |
| application_mode | varchar(20) `'auto_order'\|'manual'` | sí, default `auto_order` | ver E.3: el usuario elige cómo se distribuye este pago |
| application_order | jsonb (`string[]`) | sólo si `application_mode='auto_order'` | orden de componentes elegido por el usuario para este pago, ej. `["late_fee","interest","other_charges","principal"]`; se guarda tal cual se usó, para auditoría |
| amount | numeric(14,2) | sí | monto recibido, en `currency_code` |
| currency_code | varchar(3) → cob_currencies.code | sí | moneda en la que efectivamente se recibió |
| exchange_rate | numeric(10,4) | no | obligatorio sólo si `currency_code` ≠ moneda de la operación (§18) |
| converted_amount | numeric(14,2) | no | `amount * exchange_rate`, en moneda de la operación; calculado y guardado explícitamente, nunca implícito |
| payment_method | varchar(20) `'bank_transfer'\|'deposit'\|'cash'\|'card'\|'check'\|'other'` | sí | |
| payment_date | date | sí | |
| reference_number | varchar(100) | no | |
| bank_name | varchar(100) | no | |
| receipt_url | varchar(500) | no | comprobante adjunto (vía `@vercel/blob`, igual que `personnel_documents`) |
| observations | text | no | |
| status | varchar(20) `'confirmed'\|'reversed'\|'cancelled'` | sí, default `confirmed` | |
| reversal_reason | text | no | |
| reversed_by, reversed_at | uuid/timestamp | no | |
| registered_by | uuid → users.id | sí | usuario administrativo que lo cargó |
| created_at, updated_at | | sí | |

### C.10 `cob_payment_allocations`
Distribuye un pago entre una o más cuotas (§10).

| campo | tipo | oblig. |
|---|---|---|
| id (PK) | uuid | sí |
| payment_id | uuid → cob_payments.id | sí |
| installment_id | uuid → cob_installments.id | sí |
| allocated_principal | numeric(14,2) | sí, default 0 |
| allocated_interest | numeric(14,2) | sí, default 0 |
| allocated_late_fee | numeric(14,2) | sí, default 0 |
| allocated_other | numeric(14,2) | sí, default 0 |
| allocated_amount | numeric(14,2) | sí | suma de los anteriores |
| created_at | timestamp | sí |

Constraint de negocio (aplicado en el service, no en SQL): `sum(allocated_amount)` por
`payment_id` nunca supera `cob_payments.converted_amount` (o `amount` si es la misma moneda).

### C.11 `cob_late_fee_configurations`
Configuración de mora (§12) — jerarquía de scope + histórico de vigencias.

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| scope | varchar(20) `'global'\|'project'\|'operation'` | sí | |
| scope_id | uuid, nullable | no (null sólo si `scope='global'`) | id de `cob_projects` u `cob_operations` según `scope` |
| grace_days | smallint | sí, default 0 | días de gracia antes de considerar mora |
| calculation_method | varchar(30) `'fixed_amount'\|'percentage_of_installment'\|'daily_rate_on_balance'\|'daily_rate_on_overdue_installment'` | sí | |
| rate_value | numeric(10,5) | sí | interpretación según `calculation_method` |
| max_cap_amount | numeric(14,2) | no | tope absoluto |
| max_cap_percentage | numeric(6,3) | no | tope relativo a la cuota |
| effective_from | date | sí | |
| effective_to | date | no | null = vigente |
| created_by, created_at | | sí | |

Resolución de la config aplicable a una cuota: se busca primero `scope='operation'` vigente,
si no existe `scope='project'` vigente, si no existe el `scope='global'` vigente. Nunca se
edita una fila existente para cambiar una tasa: se cierra (`effective_to`) y se crea una nueva.

### C.12 `cob_events`
Ledger de auditoría del módulo (§17). Deliberadamente **sin FK física** hacia cada tipo de
entidad (sería una FK condicional imposible de expresar limpiamente en SQL); se valida en la
capa de aplicación. `operation_id` sí es una FK real porque casi todo evento cuelga de una
operación y se necesita poder listar "todo lo que pasó en esta operación" con una sola query.

| campo | tipo | oblig. | notas |
|---|---|---|---|
| id (PK) | uuid | sí | |
| operation_id | uuid → cob_operations.id, nullable | no | null sólo para eventos a nivel cliente (ej. cliente creado) |
| entity_type | varchar(20) `'client'\|'operation'\|'plan_version'\|'stage'\|'installment'\|'payment'\|'late_fee_config'` | sí | |
| entity_id | uuid | sí | |
| event_type | varchar(50) | sí | ej. `operation_created`, `plan_version_activated`, `installments_generated`, `payment_registered`, `payment_reversed`, `late_fee_recalculated`, `plan_refinanced`, `operation_cancelled`. Se guarda como `varchar` libre (no unión estricta) para no requerir migración cada vez que se agregue un tipo de evento nuevo. |
| description | text | sí | resumen legible ("Pago de USD 1.500 aplicado a cuotas #12 y #13") |
| amount_delta | numeric(14,2) | no | |
| balance_before | numeric(14,2) | no | |
| balance_after | numeric(14,2) | no | |
| metadata | jsonb | no | detalle estructurado propio del `event_type` |
| performed_by | uuid → users.id, nullable | no | null sólo en eventos generados por cron (recalculo de mora) |
| performed_at | timestamp | sí, default now() | |

Índices: `operation_id`, `(entity_type, entity_id)`, `performed_at`.

---

## D. Relaciones — cuáles son opcionales y por qué

| Relación | Opcional? | Motivo |
|---|---|---|
| `cob_operation.property_id` | **Sí** | requisito explícito §4: operaciones históricas sin inmueble catalogado |
| `cob_property.project_id` | **Sí** | un inmueble histórico puede no pertenecer a ningún proyecto registrado |
| `cob_payment.operation_id` | Sí | un pago podría, en teoría, registrarse a nivel cliente antes de asignarlo (poco común, pero la tabla de allocations es la fuente real de verdad) |
| `cob_payment_plan_version.replaces_version_id` | Sí | sólo se llena en refinanciaciones/recálculos, no en la versión inicial |
| `cob_payment_plan_version.triggering_payment_id` | Sí | sólo si la versión nació de un pago extraordinario |
| `cob_plan_stage.balloon_amount` / `grace_period_*` | Sí | sólo aplican a ciertas variantes |
| `cob_operation.client_id` | **No** — obligatoria | toda operación pertenece a un cliente |
| `cob_installment.plan_version_id` / `stage_id` | **No** — obligatorias | una cuota siempre nace de una etapa concreta |

---

## E. Motor financiero

### E.1 Principio de diseño

El motor es un conjunto de **funciones puras** (sin acceso a base de datos) organizadas como
estrategias por `stage_type`. Cada una recibe `(stage, openingBalance, startDate)` y devuelve
un arreglo de "borradores de cuota" (número, fecha, capital, interés, cargos, saldo final). La
persistencia (crear las filas `cob_installments`) la hace un servicio separado que además
escribe el evento de auditoría.

```text
calculateSchedule(stage, openingBalance, startDate) -> InstallmentDraft[]
        │
        ├── 'cash'              -> una sola cuota por el total, en start_date
        ├── 'fixed_installment' -> capital / N + interest_rate (puede ser 0) +
        │                          flat_fee_per_installment, con ajuste de redondeo
        │                          en la última cuota
        ├── 'french'            -> cuota constante = P·i / (1-(1+i)^-n),
        │                          tabla de amortización estándar
        └── 'custom'            -> lee `stage.config` (jsonb) para reglas ad-hoc
                                    (cuotas variables, etc.)
```

Encadenamiento de etapas: el `opening_balance` de la etapa N+1 es exactamente el
`closing_balance` final de la etapa N. Esto es lo que permite el caso "24 meses sin interés +
36 meses sistema francés" (§7/§14) sin ningún caso especial en el modelo de datos — son dos
filas en `cob_plan_stages` con `sequence_number` 1 y 2.

### E.2 Períodos de gracia y balloon

- **Gracia total**: no se genera cuota (o se genera con `total_amount = 0`); el interés del
  período se capitaliza sumándolo al `opening_balance` de la siguiente cuota real.
- **Gracia sólo interés**: se generan cuotas con `principal_amount = 0`, `interest_amount` =
  interés del período, `closing_balance = opening_balance` (no baja el capital).
- **Balloon**: el motor resuelve la cuota constante de las N-1 cuotas regulares de forma que,
  dado el `balloon_amount` fijado para la última, el saldo llegue exactamente a cero.

### E.3 Pagos parciales y extraordinarios (§10, §11)

Servicio único `applyPayment(paymentInput, targetInstallments?)`:

1. Crea la fila `cob_payments`.
2. Determina las cuotas objetivo: si el usuario las eligió explícitamente, se usan esas; si
   no, orden automático **más antigua vencida primero** (oldest-first).
3. Para cada cuota, aplica el monto disponible en el **orden que el usuario elija al registrar
   el pago** (`application_order`, ej. `mora → interés → cargos → capital`, o cualquier otra
   secuencia de esos cuatro componentes). La UI de registro de pago propone un orden por
   defecto (el más común: mora → interés → cargos → capital), pero administración puede
   cambiarlo pago por pago; lo elegido queda guardado en `cob_payments.application_order` para
   que quede claro cómo se distribuyó ese pago en particular. Si en cambio se necesita control
   total (montos distintos por componente en cada cuota), se usa `application_mode='manual'` y
   el usuario ingresa directamente `{installment_id, principal, interest, late_fee, other}` por
   cuota, sin pasar por ningún orden automático.
4. Actualiza `paid_*`, `paid_amount`, `balance_due` y `status` de cada cuota tocada.
5. Crea una fila `cob_payment_allocations` por cada cuota tocada.
6. Recalcula los campos caché de `cob_operations` (`current_balance`, `total_paid`,
   `overdue_amount`).
7. Registra un evento en `cob_events` con `balance_before`/`balance_after`.

Todo el paso 1-7 ocurre en una única transacción de base de datos.

**Pago extraordinario** (excedente sobre la cuota corriente): se registra igual que arriba
(`payment_category = 'extraordinary'`), y adicionalmente administración elige una estrategia:

- *Reducir capital, mantener plazo* → recalcula cuota francesa restante (nueva
  `cob_payment_plan_version`, `reason = 'prepayment_recalculation'`, `triggering_payment_id`
  apuntando al pago).
- *Reducir capital, mantener cuota (acortar plazo)* → idem, pero recalcula `installments_count`
  en vez de la cuota.
- *Dejar como saldo a favor* → no genera versión nueva; el importe queda reflejado en
  `cob_payment_allocations` contra una cuota "virtual" de crédito, o simplemente reduce
  `current_balance` cacheado y se aplica automáticamente a la próxima cuota que venza (opción
  recomendada por simplicidad).

En cualquier caso, **las cuotas ya generadas de la versión anterior no se editan**: la versión
vieja pasa a `superseded`, y una nueva versión (con nuevas etapas/cuotas) la reemplaza desde la
`effective_date` en adelante.

### E.4 Mora

Job/función `recalculateLateFees(asOfDate)`:

1. Para cada cuota con `status IN ('pending','partial')` y `due_date < asOfDate - grace_days`,
   resuelve la configuración aplicable (`cob_late_fee_configurations`, jerarquía operación →
   proyecto → global).
2. Calcula la mora según `calculation_method` y aplica los topes (`max_cap_*`).
3. Actualiza `late_fee_amount` y `balance_due` de la cuota.
4. Si cambió respecto al valor anterior, escribe un evento `late_fee_recalculated`.

Puede correr por cron diario (ver `src/app/api/cron/` ya existe un patrón similar con
`due-tasks`) o calcularse on-demand al abrir la ficha del cliente/operación — ambas rutas usan
la misma función, así que nunca hay dos criterios de mora distintos.

"Vencida" (estado visual, no persistido como transición de `status`, ver C.8) =
`due_date < hoy AND status IN ('pending','partial')`.

### E.5 Cancelación anticipada (§22)

Función de sólo-lectura `calculateSettlementQuote(operationId, asOfDate)`:

```text
capital pendiente (suma de closing_balance de cuotas no pagadas)
+ interés ya devengado y no facturado (si corta a mitad de período)
+ mora pendiente
+ cargos pendientes
- descuento manual (si administración decide otorgar uno, explícito, con motivo)
─────────────────────────────
= monto de liquidación
```

No escribe nada hasta que se confirma. Al confirmarse, se registra como un pago
`payment_category = 'settlement'` que salda todas las cuotas pendientes de la versión activa
(vía allocations) y cambia `cob_operations.status = 'completed'`.

---

## F. Auditoría — cómo se garantiza la trazabilidad

- **Nunca hay `DELETE`** sobre `cob_operations`, `cob_payment_plan_versions`,
  `cob_installments` ni `cob_payments`. Todo es `status = 'cancelled'` /
  `status = 'reversed'` + columnas `cancelled_at/cancelled_by/cancellation_reason` (o
  `reversed_*` en pagos).
- **`cob_events`** registra cada mutación relevante con quién, cuándo, y el saldo antes/después
  — responde directamente a las preguntas del §17 (cuándo se creó una deuda, quién registró un
  pago, por qué se modificó un plan).
- **Cada cuota es auto-explicativa**: guarda su propio desglose (`opening_balance`,
  `principal_amount`, `interest_amount`, `other_charges_amount`, `closing_balance`) más
  `engine_metadata` con los parámetros exactos usados — responde "¿por qué esta cuota es de
  USD 1.013?" sin tener que re-ejecutar el motor ni adivinar.
- **Versionado de planes** en vez de edición in-place: una refinanciación o un recálculo por
  pago extraordinario siempre crean una fila nueva en `cob_payment_plan_versions` enlazada a la
  anterior (`replaces_version_id`), nunca se tocan las cuotas viejas.
- Sugerencia de bajo costo (no es un ledger contable de doble entrada, sería sobre-ingeniería
  para este caso): un reporte de reconciliación periódico que compare
  `sum(cob_installments.paid_amount)` vs `sum(cob_payment_allocations.allocated_amount)` vs
  `sum(cob_payments.amount)` para detectar desvíos temprano.

---

## G. Ejemplos aplicados

**Caso 1 — Contado.**
`cob_operations` (original=financed=100.000, currency=USD) → 1 `cob_payment_plan_versions`
(reason=initial) → 1 `cob_plan_stages` (stage_type=`cash`) → 1 `cob_installments` (total=100.000,
due_date=start_date). Un `cob_payments` de 100.000 lo salda vía una `cob_payment_allocations`.

**Caso 2 — 24 cuotas sin interés.**
1 etapa: `stage_type='fixed_installment'`, `interest_rate=0`, `rate_type='none'`,
`installments_count=24`, `flat_fee_per_installment=0` (o el monto que administración decida
cobrar de gasto administrativo, si aplica). 24 filas en `cob_installments`, cada una con
`interest_amount=0`.

**Caso 3 — 24 meses sin interés + 36 meses francés al 8%.**
Misma `cob_payment_plan_versions`, 2 filas en `cob_plan_stages`:
etapa 1 (`sequence_number=1`, `fixed_installment`, 24, 0%), etapa 2 (`sequence_number=2`,
`french`, 36, `interest_rate=0.08`, `rate_type='nominal_annual'`). El `opening_balance` de la
cuota 25 (primera de la etapa 2) = `closing_balance` de la cuota 24.

**Caso 4 — Cliente antiguo, inmueble histórico no catalogado.**
`cob_properties` con `origin='historical'`, `project_id=NULL`,
`project_name_snapshot='Edificio XYZ'`, `unit_label='502'`. `cob_operations.property_id`
apunta a esa fila (no hace falta que `property_id` sea NULL en la operación; lo que es NULL es
el `project_id` dentro de `cob_properties`).

**Caso 5 — Dos operaciones del mismo cliente.**
Un `cob_clients`, dos filas en `cob_operations` con distinto `property_id`, cada una con su
propia línea de `cob_payment_plan_versions` → `cob_plan_stages` → `cob_installments`. El estado
de cuenta del cliente (§15) agrega ambas.

**Caso 6 — Pago parcial.**
Cuota de USD 1.500, pago de USD 1.000 → `cob_payments.amount=1000`,
`cob_payment_allocations.allocated_amount=1000` contra esa cuota, `installment.status='partial'`,
`installment.balance_due=500`.

**Caso 7 — Pago extraordinario.**
Ver E.3: `cob_payments.payment_category='extraordinary'` de USD 10.000 sobre un saldo de
50.000; administración elige "reducir capital, mantener plazo" → nueva
`cob_payment_plan_versions` (`reason='prepayment_recalculation'`,
`triggering_payment_id=<pago>`) con cuota francesa recalculada para el capital restante.

**Caso 8 — Mora.**
Cuota vencida el 10/09, hoy 17/09. No se setea manualmente ningún status: la UI/dashboard la
muestra como vencida por la regla derivada (E.4). Si hay configuración de mora vigente, el job
diario calcula `late_fee_amount` y lo refleja en `balance_due`.

**Caso 9 — Refinanciación.**
Deuda de USD 30.000 → nueva `cob_payment_plan_versions` (`reason='refinancing'`,
`replaces_version_id=<versión vieja>`) con su propia etapa (`fixed_installment`, 12, 0%). La
versión vieja pasa a `status='superseded'`; sus cuotas ya pagadas siguen intactas en el
historial, las no pagadas quedan con `status='refinanced'`.

**Caso 10 — Cancelación anticipada.**
`calculateSettlementQuote` suma capital pendiente + mora + cargos de la versión activa,
administración confirma, se registra un `cob_payments` (`payment_category='settlement'`) que
salda todas las cuotas pendientes y `cob_operations.status='completed'`.

---

## H. Dashboard y estado de cuenta (§15, §16) — de dónde sale cada número

- **Estado de cuenta de cliente**: `SUM` sobre las `cob_operations` del cliente usando las
  columnas caché (`current_balance`, `total_paid`, `overdue_amount`) + próxima cuota (`MIN
  due_date` entre pendientes). No requiere tabla nueva.
- **Dashboard general** (cartera total, cobrado, pendiente, vencido): agregaciones SQL directas
  sobre `cob_operations`/`cob_installments`. Si con el volumen real esto se vuelve lento, se
  puede introducir más adelante una vista materializada — no hace falta diseñarla ahora
  (evitar sobre-ingeniería, §29).
- **Próximos vencimientos / morosidad / cobranza del período**: queries directas sobre
  `cob_installments.due_date` y `cob_payments.payment_date`, sin tablas adicionales.

---

## I. Integración futura (§26)

`cob_operations.source` (`'manual'|'imported'`) y `external_reference` dejan la puerta abierta
para que, el día de mañana, un sistema comercial externo cree operaciones vía una acción
dedicada (`createOperationFromExternalSale(...)`) que internamente hace exactamente lo mismo
que hacer clic en "nueva operación" a mano. El módulo financiero nunca consulta al sistema
externo en tiempo real: si ese sistema cae, cobranzas sigue funcionando igual.

---

## J. Lo que decidí NO incluir todavía (para no sobre-diseñar)

- Tabla `sales` — explícitamente descartada por requisito (§25).
- Ledger contable de doble entrada tipo ERP — un `cob_events` + columnas caché reconciliables
  es suficiente para el tamaño de este problema.
- Tabla separada de "adjuntos" para comprobantes — un campo `receipt_url` alcanza hoy; si se
  necesitan varios comprobantes por pago, se agrega `cob_payment_attachments` más adelante sin
  romper nada.
- Roles/permisos nuevos — se reutiliza el esquema de roles existente con una función de
  permiso adicional.

---

## Decisiones confirmadas (2026-09-17)

1. **Clientes**: se parte de cero. `cob_clients` no importa ni referencia ninguna lista externa
   existente; toda la carga de clientes se hace dentro del módulo.
2. **Numeración de operación**: `operation_number` es un correlativo generado por el sistema
   (ej. `OP-000001`, `OP-000002`, ...), sin depender de ningún formato externo previo.
3. **Prefijo de tablas**: `cob_` (de "cobranzas"), aplicado en todo este documento.
4. **Orden de aplicación de pago**: no hay un orden fijo del sistema — **lo elige el usuario en
   cada pago** (ver E.3 y el campo `cob_payments.application_order`), con un valor por defecto
   sugerido en el formulario (mora → interés → cargos → capital) que puede cambiarse.

Con esto, el diseño queda aprobado. El siguiente paso es la implementación: esquema Drizzle +
migraciones, motor financiero con tests, y las pantallas del flujo descrito en §27.
