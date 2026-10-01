-- Migraciones pendientes para Neon: 0009 a 0013.
--   0009-0012: módulo de Cobranzas (tablas cob_*, extensión pg_trgm, índices)
--   0013:      índices de notificaciones / recordatorios / cron
--
-- ANTES DE CORRER, verificá que Neon esté en la 0008 (la última de personal):
--   select count(*) from drizzle."__drizzle_migrations";   -- debería dar 9
--   select to_regclass('public.cob_clients');              -- debería dar NULL
-- Si ya existe cob_clients, NO corras este archivo completo (avisame cuál es el estado).
--
-- Todo va en una transacción: si algo falla, no queda nada a medias.
-- Al final se registran en drizzle.__drizzle_migrations para que un futuro
-- `npm run db:migrate` no las vuelva a aplicar.

BEGIN;

-- ===== 0009_cold_banshee =====
CREATE TABLE "cob_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientType" varchar(20) DEFAULT 'person' NOT NULL,
	"firstName" varchar(150),
	"lastName" varchar(150),
	"businessName" varchar(255),
	"documentType" varchar(30) NOT NULL,
	"documentNumber" varchar(50) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"secondaryPhone" varchar(50),
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_currencies" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(5) NOT NULL,
	"decimalPlaces" smallint DEFAULT 2 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE "cob_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operationId" uuid,
	"entityType" varchar(20) NOT NULL,
	"entityId" uuid NOT NULL,
	"eventType" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"amountDelta" numeric(14, 2),
	"balanceBefore" numeric(14, 2),
	"balanceAfter" numeric(14, 2),
	"metadata" jsonb,
	"performedBy" uuid,
	"performedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planVersionId" uuid NOT NULL,
	"stageId" uuid NOT NULL,
	"installmentNumber" smallint NOT NULL,
	"dueDate" date NOT NULL,
	"openingBalance" numeric(14, 2) NOT NULL,
	"principalAmount" numeric(14, 2) NOT NULL,
	"interestAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"otherChargesAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"totalAmount" numeric(14, 2) NOT NULL,
	"closingBalance" numeric(14, 2) NOT NULL,
	"lateFeeAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paidPrincipal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paidInterest" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paidOther" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paidLateFee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paidAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balanceDue" numeric(14, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"engineMetadata" jsonb,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_late_fee_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(20) NOT NULL,
	"scopeId" uuid,
	"graceDays" smallint DEFAULT 0 NOT NULL,
	"calculationMethod" varchar(30) NOT NULL,
	"rateValue" numeric(10, 5) NOT NULL,
	"maxCapAmount" numeric(14, 2),
	"maxCapPercentage" numeric(6, 3),
	"effectiveFrom" date NOT NULL,
	"effectiveTo" date,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequenceNumber" serial NOT NULL,
	"clientId" uuid NOT NULL,
	"propertyId" uuid,
	"currencyCode" varchar(3) NOT NULL,
	"originalAmount" numeric(14, 2) NOT NULL,
	"downPaymentAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"financedAmount" numeric(14, 2) NOT NULL,
	"currentBalance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"totalPaid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"overdueAmount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"startDate" date NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"externalReference" varchar(100),
	"notes" text,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"cancelledAt" timestamp,
	"cancelledBy" uuid,
	"cancellationReason" text,
	CONSTRAINT "cob_operations_sequenceNumber_unique" UNIQUE("sequenceNumber")
);

CREATE TABLE "cob_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paymentId" uuid NOT NULL,
	"installmentId" uuid NOT NULL,
	"allocatedPrincipal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"allocatedInterest" numeric(14, 2) DEFAULT '0' NOT NULL,
	"allocatedLateFee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"allocatedOther" numeric(14, 2) DEFAULT '0' NOT NULL,
	"allocatedAmount" numeric(14, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" uuid NOT NULL,
	"operationId" uuid,
	"paymentCategory" varchar(20) DEFAULT 'regular' NOT NULL,
	"applicationMode" varchar(20) DEFAULT 'auto_order' NOT NULL,
	"applicationOrder" jsonb,
	"amount" numeric(14, 2) NOT NULL,
	"currencyCode" varchar(3) NOT NULL,
	"exchangeRate" numeric(10, 4),
	"convertedAmount" numeric(14, 2),
	"paymentMethod" varchar(20) NOT NULL,
	"paymentDate" date NOT NULL,
	"referenceNumber" varchar(100),
	"bankName" varchar(100),
	"receiptUrl" varchar(500),
	"observations" text,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"reversalReason" text,
	"reversedBy" uuid,
	"reversedAt" timestamp,
	"registeredBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_payment_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operationId" uuid NOT NULL,
	"versionNumber" smallint NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"reason" varchar(30) DEFAULT 'initial' NOT NULL,
	"replacesVersionId" uuid,
	"triggeringPaymentId" uuid,
	"effectiveDate" date NOT NULL,
	"notes" text,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"supersededBy" uuid,
	"supersededAt" timestamp
);

CREATE TABLE "cob_plan_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planVersionId" uuid NOT NULL,
	"sequenceNumber" smallint NOT NULL,
	"stageType" varchar(30) NOT NULL,
	"installmentsCount" smallint,
	"periodicity" varchar(20) DEFAULT 'monthly' NOT NULL,
	"interestRate" numeric(8, 5),
	"rateType" varchar(20) DEFAULT 'none' NOT NULL,
	"flatFeePerInstallment" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gracePeriodMonths" smallint DEFAULT 0 NOT NULL,
	"gracePeriodType" varchar(20),
	"balloonAmount" numeric(14, 2),
	"config" jsonb,
	"startDate" date,
	"endDate" date,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "cob_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" varchar(20) DEFAULT 'catalog' NOT NULL,
	"projectId" uuid,
	"projectNameSnapshot" varchar(255) NOT NULL,
	"unitLabel" varchar(50) NOT NULL,
	"propertyType" varchar(30),
	"areaM2" numeric(8, 2),
	"floor" varchar(20),
	"description" text,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "cob_clients" ADD CONSTRAINT "cob_clients_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_events" ADD CONSTRAINT "cob_events_operationId_cob_operations_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."cob_operations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "cob_events" ADD CONSTRAINT "cob_events_performedBy_users_id_fk" FOREIGN KEY ("performedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_installments" ADD CONSTRAINT "cob_installments_planVersionId_cob_payment_plan_versions_id_fk" FOREIGN KEY ("planVersionId") REFERENCES "public"."cob_payment_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_installments" ADD CONSTRAINT "cob_installments_stageId_cob_plan_stages_id_fk" FOREIGN KEY ("stageId") REFERENCES "public"."cob_plan_stages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_late_fee_configurations" ADD CONSTRAINT "cob_late_fee_configurations_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_clientId_cob_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."cob_clients"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_propertyId_cob_properties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."cob_properties"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_currencyCode_cob_currencies_code_fk" FOREIGN KEY ("currencyCode") REFERENCES "public"."cob_currencies"("code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_cancelledBy_users_id_fk" FOREIGN KEY ("cancelledBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payment_allocations" ADD CONSTRAINT "cob_payment_allocations_paymentId_cob_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."cob_payments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payment_allocations" ADD CONSTRAINT "cob_payment_allocations_installmentId_cob_installments_id_fk" FOREIGN KEY ("installmentId") REFERENCES "public"."cob_installments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payments" ADD CONSTRAINT "cob_payments_clientId_cob_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."cob_clients"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payments" ADD CONSTRAINT "cob_payments_operationId_cob_operations_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."cob_operations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "cob_payments" ADD CONSTRAINT "cob_payments_currencyCode_cob_currencies_code_fk" FOREIGN KEY ("currencyCode") REFERENCES "public"."cob_currencies"("code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payments" ADD CONSTRAINT "cob_payments_reversedBy_users_id_fk" FOREIGN KEY ("reversedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payments" ADD CONSTRAINT "cob_payments_registeredBy_users_id_fk" FOREIGN KEY ("registeredBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payment_plan_versions" ADD CONSTRAINT "cob_payment_plan_versions_operationId_cob_operations_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."cob_operations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payment_plan_versions" ADD CONSTRAINT "cob_payment_plan_versions_replacesVersionId_cob_payment_plan_versions_id_fk" FOREIGN KEY ("replacesVersionId") REFERENCES "public"."cob_payment_plan_versions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "cob_payment_plan_versions" ADD CONSTRAINT "cob_payment_plan_versions_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_payment_plan_versions" ADD CONSTRAINT "cob_payment_plan_versions_supersededBy_users_id_fk" FOREIGN KEY ("supersededBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_plan_stages" ADD CONSTRAINT "cob_plan_stages_planVersionId_cob_payment_plan_versions_id_fk" FOREIGN KEY ("planVersionId") REFERENCES "public"."cob_payment_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_plan_stages" ADD CONSTRAINT "cob_plan_stages_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_projects" ADD CONSTRAINT "cob_projects_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cob_properties" ADD CONSTRAINT "cob_properties_projectId_cob_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."cob_projects"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "cob_properties" ADD CONSTRAINT "cob_properties_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "cob_clients_document_idx" ON "cob_clients" USING btree ("documentType","documentNumber");
CREATE INDEX "cob_events_operation_idx" ON "cob_events" USING btree ("operationId");
CREATE INDEX "cob_events_entity_idx" ON "cob_events" USING btree ("entityType","entityId");
CREATE INDEX "cob_installments_plan_version_idx" ON "cob_installments" USING btree ("planVersionId");
CREATE INDEX "cob_installments_due_date_idx" ON "cob_installments" USING btree ("dueDate");

-- ===== 0010_seed_cob_currencies =====
INSERT INTO "cob_currencies" ("code", "name", "symbol", "decimalPlaces") VALUES
	('USD', 'Dólar estadounidense', '$', 2),
	('BOB', 'Boliviano', 'Bs', 2)
ON CONFLICT ("code") DO NOTHING;

-- ===== 0011_far_infant_terrible =====
ALTER TABLE "cob_operations" ADD COLUMN "referenceCurrencyCode" varchar(3);
ALTER TABLE "cob_operations" ADD COLUMN "referenceExchangeRate" numeric(10, 4);
ALTER TABLE "cob_plan_stages" ADD COLUMN "openingBalanceOverride" numeric(14, 2);
ALTER TABLE "cob_operations" ADD CONSTRAINT "cob_operations_referenceCurrencyCode_cob_currencies_code_fk" FOREIGN KEY ("referenceCurrencyCode") REFERENCES "public"."cob_currencies"("code") ON DELETE no action ON UPDATE no action;

-- ===== 0012_foamy_cerebro =====
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "cob_clients_email_idx" ON "cob_clients" USING btree ("email");
CREATE INDEX "cob_clients_first_name_trgm_idx" ON "cob_clients" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX "cob_clients_last_name_trgm_idx" ON "cob_clients" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX "cob_clients_business_name_trgm_idx" ON "cob_clients" USING gin ("businessName" gin_trgm_ops);
CREATE INDEX "cob_clients_document_number_trgm_idx" ON "cob_clients" USING gin ("documentNumber" gin_trgm_ops);
CREATE INDEX "cob_events_performed_at_idx" ON "cob_events" USING btree ("performedAt");
CREATE INDEX "cob_installments_status_idx" ON "cob_installments" USING btree ("status");
CREATE INDEX "cob_operations_client_idx" ON "cob_operations" USING btree ("clientId");
CREATE INDEX "cob_operations_status_idx" ON "cob_operations" USING btree ("status");
CREATE INDEX "cob_payment_allocations_payment_idx" ON "cob_payment_allocations" USING btree ("paymentId");
CREATE INDEX "cob_payment_allocations_installment_idx" ON "cob_payment_allocations" USING btree ("installmentId");
CREATE INDEX "cob_payments_client_idx" ON "cob_payments" USING btree ("clientId");
CREATE INDEX "cob_payments_operation_idx" ON "cob_payments" USING btree ("operationId");
CREATE INDEX "cob_payments_payment_date_idx" ON "cob_payments" USING btree ("paymentDate");
CREATE INDEX "cob_payments_status_idx" ON "cob_payments" USING btree ("status");
CREATE INDEX "cob_payment_plan_versions_operation_idx" ON "cob_payment_plan_versions" USING btree ("operationId");
CREATE UNIQUE INDEX "cob_payment_plan_versions_one_active_idx" ON "cob_payment_plan_versions" USING btree ("operationId") WHERE "cob_payment_plan_versions"."status" = 'active';
CREATE INDEX "cob_plan_stages_plan_version_idx" ON "cob_plan_stages" USING btree ("planVersionId");

-- ===== 0013_large_madame_masque =====
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("userId","createdAt" DESC NULLS LAST);
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("userId") WHERE "notifications"."read" = false;
CREATE INDEX "notifications_task_idx" ON "notifications" USING btree ("taskId");
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("userId");
CREATE INDEX "tasks_overdue_pending_idx" ON "tasks" USING btree ("dueAt") WHERE "tasks"."dueAt" is not null and "tasks"."overdueNotifiedAt" is null and "tasks"."status" not in ('done', 'cancelled');
CREATE INDEX "task_reminders_task_idx" ON "task_reminders" USING btree ("taskId");
CREATE INDEX "task_reminders_pending_idx" ON "task_reminders" USING btree ("taskId") WHERE "task_reminders"."notifiedAt" is null;

-- ===== Registro en drizzle =====
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ('44dce6c0671d35ec3abc7d2fac2c5de51cc9080db42a47984cd9abb62f137967', 1789676062329);  -- 0009_cold_banshee
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ('85a65180c2d4d435a4cacbdd6c4b16186e82997ec9d691e4af66b7ac8284ce7f', 1789676085627);  -- 0010_seed_cob_currencies
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ('e43a727401c45493f5844a6c0cfc7f73c05e4fdaf01ca022df54c498d0393108', 1789680105397);  -- 0011_far_infant_terrible
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ('af3fc2b29176a0747bb7194156c2e0d9333eb1403e3b1686587d01c933ee9fdc', 1790359914567);  -- 0012_foamy_cerebro
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ('e930ad947d998ecedf029a4d4fdf23e50805a071340f45a7562132dbcf84ed3a', 1790881220394);  -- 0013_large_madame_masque

COMMIT;
