-- Cleanup existing policies and objects
DROP POLICY IF EXISTS "Users can view own audit events" ON audit_events;
DROP POLICY IF EXISTS "Users can view own credit ledger" ON credit_ledger;
DROP POLICY IF EXISTS "Users can view own artwork versions" ON artwork_versions;
DROP POLICY IF EXISTS "Users can create own artwork versions" ON artwork_versions;
DROP POLICY IF EXISTS "Users can update own artwork versions" ON artwork_versions;
DROP POLICY IF EXISTS "Users can delete own artwork versions" ON artwork_versions;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert mockup templates" ON mockup_templates;
DROP POLICY IF EXISTS "Users can update mockup templates" ON mockup_templates;
DROP POLICY IF EXISTS "Users can delete mockup templates" ON mockup_templates;
DROP POLICY IF EXISTS "Authenticated users can view mockup templates" ON mockup_templates;
DROP VIEW IF EXISTS credits CASCADE;
DROP FUNCTION IF EXISTS log_audit_event;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS credit_ledger CASCADE;
DROP TABLE IF EXISTS artwork_versions CASCADE;
