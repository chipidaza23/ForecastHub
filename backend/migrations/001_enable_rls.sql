-- Enable Row Level Security on core tables
-- Apply these via Supabase SQL Editor or CLI

ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own sales data
CREATE POLICY "users_own_sales_data" ON sales_data
  FOR ALL
  USING (auth.uid()::text = user_id);

-- Policy: users can only access their own uploads
CREATE POLICY "users_own_uploads" ON uploads
  FOR ALL
  USING (auth.uid()::text = user_id);

-- Service role bypasses RLS automatically
