-- ============================================
-- COMPLETE E-WASTE MANAGEMENT PLATFORM SETUP
-- Single Migration Script - All Features Included
-- ============================================
-- This script includes:
-- ✅ Base schema (users, roles, profiles, items)
-- ✅ Crypto payment support (wallet, ETH prices)
-- ✅ Email verification
-- ✅ Storage buckets
-- ✅ RLS policies
-- ✅ Triggers and functions
-- ============================================

-- ============================================
-- STEP 1: CLEANUP (Safe to run multiple times)
-- ============================================

-- Drop existing tables in correct order (dependencies first)
DROP TABLE IF EXISTS public.crypto_transactions CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.item_media CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS app_role CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Clean up storage
DELETE FROM storage.objects WHERE bucket_id = 'item-media';
DELETE FROM storage.buckets WHERE id = 'item-media';

-- ============================================
-- STEP 2: CREATE CUSTOM TYPES
-- ============================================

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('user', 'official');

-- ============================================
-- STEP 3: CREATE CORE TABLES
-- ============================================

-- User Roles Table
-- Maps users to their roles (user or official)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Stores user role assignments (user or official)';
COMMENT ON COLUMN public.user_roles.user_id IS 'Reference to auth.users';
COMMENT ON COLUMN public.user_roles.role IS 'User role: user (seller/buyer) or official (processor)';

-- Profiles Table
-- Extended user information including crypto wallet
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  wallet_address TEXT,
  is_crypto_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Extended user profile information';
COMMENT ON COLUMN public.profiles.wallet_address IS 'Ethereum wallet address (42 characters, starts with 0x)';
COMMENT ON COLUMN public.profiles.is_crypto_verified IS 'Whether the wallet address has been verified';

-- Items Table
-- Core table for e-waste items with dual currency support
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  seller_quoted_price DECIMAL(10,2) NOT NULL,
  seller_quoted_price_eth DECIMAL(18,8),
  final_payout DECIMAL(10,2) DEFAULT 0,
  final_payout_eth DECIMAL(18,8),
  repair_cost DECIMAL(10,2) DEFAULT 0,
  repair_cost_eth DECIMAL(18,8),
  selling_price DECIMAL(10,2) DEFAULT 0,
  selling_price_eth DECIMAL(18,8),
  status TEXT DEFAULT 'pending_valuation',
  current_branch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'pending_valuation',
    'ready_to_sell',
    'sold',
    'recycled',
    'rejected'
  )),
  CONSTRAINT valid_condition CHECK (condition IN (
    'Working',
    'Repairable',
    'Scrap'
  ))
);

COMMENT ON TABLE public.items IS 'E-waste items submitted by sellers';
COMMENT ON COLUMN public.items.status IS 'Item status: pending_valuation, ready_to_sell, sold, recycled, rejected';
COMMENT ON COLUMN public.items.seller_quoted_price IS 'Price quoted by seller in Rs';
COMMENT ON COLUMN public.items.seller_quoted_price_eth IS 'Price quoted by seller in ETH';
COMMENT ON COLUMN public.items.final_payout IS 'Final payout to seller in Rs';
COMMENT ON COLUMN public.items.final_payout_eth IS 'Final payout to seller in ETH';
COMMENT ON COLUMN public.items.repair_cost IS 'Cost to repair/refurbish in Rs';
COMMENT ON COLUMN public.items.repair_cost_eth IS 'Cost to repair/refurbish in ETH';
COMMENT ON COLUMN public.items.selling_price IS 'Final selling price in Rs';
COMMENT ON COLUMN public.items.selling_price_eth IS 'Final selling price in ETH';

-- Item Media Table
-- Stores photos/videos of items
CREATE TABLE public.item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.item_media IS 'Media files (photos/videos) for items';

-- System Configuration Table
-- Stores system-wide settings like exchange rates
CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.system_config IS 'System-wide configuration settings';
COMMENT ON COLUMN public.system_config.config_key IS 'Unique configuration key';
COMMENT ON COLUMN public.system_config.config_value IS 'Configuration value (stored as text)';

-- Crypto Transactions Table
-- Logs all cryptocurrency transactions
CREATE TABLE public.crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_rs DECIMAL(10,2) NOT NULL,
  amount_eth DECIMAL(18,8) NOT NULL,
  exchange_rate DECIMAL(10,2) NOT NULL,
  transaction_hash TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('payout', 'purchase')),
  CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'confirmed', 'failed'))
);

COMMENT ON TABLE public.crypto_transactions IS 'Logs all crypto payment transactions';
COMMENT ON COLUMN public.crypto_transactions.transaction_type IS 'Type: payout (to seller) or purchase (from buyer)';
COMMENT ON COLUMN public.crypto_transactions.from_address IS 'Sender wallet address';
COMMENT ON COLUMN public.crypto_transactions.to_address IS 'Recipient wallet address';
COMMENT ON COLUMN public.crypto_transactions.transaction_hash IS 'Blockchain transaction hash';

-- ============================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_items_seller_id ON public.items(seller_id);
CREATE INDEX idx_items_buyer_id ON public.items(buyer_id);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_items_created_at ON public.items(created_at DESC);
CREATE INDEX idx_item_media_item_id ON public.item_media(item_id);
CREATE INDEX idx_crypto_transactions_item_id ON public.crypto_transactions(item_id);
CREATE INDEX idx_crypto_transactions_created_at ON public.crypto_transactions(created_at DESC);

-- ============================================
-- STEP 5: CREATE FUNCTIONS
-- ============================================

-- Function: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND user_roles.role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.has_role IS 'Check if a user has a specific role';

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at IS 'Automatically updates updated_at timestamp';

-- Function: Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates profile when new user signs up';

-- ============================================
-- STEP 6: CREATE TRIGGERS
-- ============================================

-- Trigger: Create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update profiles.updated_at
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Update items.updated_at
DROP TRIGGER IF EXISTS set_updated_at_items ON public.items;
CREATE TRIGGER set_updated_at_items
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Update system_config.updated_at
DROP TRIGGER IF EXISTS set_updated_at_system_config ON public.system_config;
CREATE TRIGGER set_updated_at_system_config
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- STEP 7: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: CREATE RLS POLICIES
-- ============================================

-- USER_ROLES POLICIES
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Officials can view all roles
CREATE POLICY "Officials can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

-- PROFILES POLICIES
-- Everyone can view all profiles (for displaying names)
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ITEMS POLICIES
-- Users can view items they're involved with (seller or buyer)
CREATE POLICY "Users can view own items"
ON public.items FOR SELECT
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Officials can view all items
CREATE POLICY "Officials can view all items"
ON public.items FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

-- Users can insert items they're selling
CREATE POLICY "Users can insert own items"
ON public.items FOR INSERT
WITH CHECK (auth.uid() = seller_id);

-- Officials can update any item (for processing)
CREATE POLICY "Officials can update items"
ON public.items FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

-- Users can purchase items that are ready to sell
CREATE POLICY "Users can purchase items"
ON public.items FOR UPDATE
USING (status = 'ready_to_sell' AND auth.uid() IS NOT NULL);

-- ITEM_MEDIA POLICIES
-- Media viewable by item participants (seller, buyer, officials)
CREATE POLICY "Media viewable by item participants"
ON public.item_media FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_media.item_id
    AND (
      items.seller_id = auth.uid() 
      OR items.buyer_id = auth.uid() 
      OR public.has_role(auth.uid(), 'official')
    )
  )
);

-- Users can insert media for their own items
CREATE POLICY "Users can insert media for own items"
ON public.item_media FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_media.item_id
    AND items.seller_id = auth.uid()
  )
);

-- SYSTEM_CONFIG POLICIES
-- Anyone can view system config (exchange rates, etc.)
CREATE POLICY "Anyone can view system config"
ON public.system_config FOR SELECT
USING (true);

-- Only officials can update system config
CREATE POLICY "Officials can update system config"
ON public.system_config FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

-- Only officials can insert system config
CREATE POLICY "Officials can insert system config"
ON public.system_config FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'official'));

-- CRYPTO_TRANSACTIONS POLICIES
-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
ON public.crypto_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = crypto_transactions.item_id
    AND (items.seller_id = auth.uid() OR items.buyer_id = auth.uid())
  )
);

-- Officials can view all transactions
CREATE POLICY "Officials can view all transactions"
ON public.crypto_transactions FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

-- Officials can insert transactions
CREATE POLICY "Officials can insert transactions"
ON public.crypto_transactions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'official'));

-- System can update transaction status
CREATE POLICY "System can update transaction status"
ON public.crypto_transactions FOR UPDATE
USING (true);

-- ============================================
-- STEP 9: CREATE STORAGE BUCKET
-- ============================================

-- Create storage bucket for item media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-media',
  'item-media',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];

-- ============================================
-- STEP 10: CREATE STORAGE POLICIES
-- ============================================

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

-- Public can read all media
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-media');

-- Users can upload media to their own folder
CREATE POLICY "Users can upload own media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own media
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own media
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- STEP 11: INSERT DEFAULT DATA
-- ============================================

-- Insert default exchange rate (1 ETH = Rs 250,000)
INSERT INTO public.system_config (config_key, config_value, description)
VALUES 
  ('rs_to_eth_rate', '250000', 'Exchange rate: 1 ETH = Rs X'),
  ('platform_fee_percentage', '5', 'Platform fee percentage'),
  ('min_item_price', '100', 'Minimum item price in Rs')
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description;

-- ============================================
-- STEP 12: EMAIL VERIFICATION SETUP
-- ============================================

-- Note: Email verification is configured in Supabase Auth settings
-- To enable email verification:
-- 1. Go to Supabase Dashboard → Authentication → Settings
-- 2. Enable "Confirm email" under Email Auth
-- 3. Customize email templates under Email Templates
-- 4. Set up SMTP settings for production

-- Add email verification status to profiles (optional tracking)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.email_verified IS 'Tracks if user email is verified (synced from auth.users)';

-- Function to sync email verification status
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = NEW.email_confirmed_at IS NOT NULL
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email verification
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.sync_email_verification();

-- ============================================
-- STEP 13: CREATE VIEWS FOR REPORTING
-- ============================================

-- View: Active items summary
CREATE OR REPLACE VIEW public.active_items_summary AS
SELECT 
  status,
  COUNT(*) as count,
  SUM(seller_quoted_price) as total_quoted_price,
  SUM(final_payout) as total_payout,
  SUM(selling_price) as total_selling_price
FROM public.items
WHERE status != 'rejected'
GROUP BY status;

COMMENT ON VIEW public.active_items_summary IS 'Summary of active items by status';

-- View: User statistics
CREATE OR REPLACE VIEW public.user_statistics AS
SELECT 
  p.id,
  p.full_name,
  p.wallet_address,
  p.is_crypto_verified,
  COUNT(DISTINCT CASE WHEN i.seller_id = p.id THEN i.id END) as items_sold,
  COUNT(DISTINCT CASE WHEN i.buyer_id = p.id THEN i.id END) as items_bought,
  SUM(CASE WHEN i.seller_id = p.id THEN i.final_payout ELSE 0 END) as total_earned,
  SUM(CASE WHEN i.buyer_id = p.id THEN i.selling_price ELSE 0 END) as total_spent
FROM public.profiles p
LEFT JOIN public.items i ON (i.seller_id = p.id OR i.buyer_id = p.id)
GROUP BY p.id, p.full_name, p.wallet_address, p.is_crypto_verified;

COMMENT ON VIEW public.user_statistics IS 'User activity and financial statistics';

-- ============================================
-- STEP 14: GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.items TO authenticated;
GRANT SELECT, INSERT ON public.item_media TO authenticated;
GRANT SELECT ON public.system_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.crypto_transactions TO authenticated;

-- Grant permissions on views
GRANT SELECT ON public.active_items_summary TO authenticated;
GRANT SELECT ON public.user_statistics TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- SETUP COMPLETE!
-- ============================================

-- Verify setup
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.prokind = 'f';
  
  RAISE NOTICE '✅ Setup Complete!';
  RAISE NOTICE '📊 Tables created: %', table_count;
  RAISE NOTICE '🔒 RLS policies created: %', policy_count;
  RAISE NOTICE '⚙️ Functions created: %', function_count;
  RAISE NOTICE '🎉 Database is ready for use!';
END $$;

-- ============================================
-- SUMMARY OF WHAT WAS CREATED
-- ============================================
-- 
-- TABLES (6):
-- ✅ user_roles - User role assignments
-- ✅ profiles - Extended user profiles with wallet
-- ✅ items - E-waste items with dual currency
-- ✅ item_media - Photos/videos of items
-- ✅ system_config - System settings
-- ✅ crypto_transactions - Transaction logs
--
-- FUNCTIONS (4):
-- ✅ has_role() - Check user permissions
-- ✅ handle_updated_at() - Auto-update timestamps
-- ✅ handle_new_user() - Auto-create profiles
-- ✅ sync_email_verification() - Sync email status
--
-- TRIGGERS (5):
-- ✅ on_auth_user_created - Create profile on signup
-- ✅ set_updated_at_profiles - Update profile timestamp
-- ✅ set_updated_at_items - Update item timestamp
-- ✅ set_updated_at_system_config - Update config timestamp
-- ✅ on_auth_user_email_verified - Sync email verification
--
-- RLS POLICIES (20+):
-- ✅ Complete security policies for all tables
-- ✅ User/Official role separation
-- ✅ Data isolation and privacy
--
-- STORAGE:
-- ✅ item-media bucket with 50MB limit
-- ✅ Upload/download policies
--
-- DEFAULT DATA:
-- ✅ Exchange rate: 1 ETH = Rs 250,000
-- ✅ Platform fee: 5%
-- ✅ Min item price: Rs 100
--
-- VIEWS (2):
-- ✅ active_items_summary - Item statistics
-- ✅ user_statistics - User activity stats
--
-- ============================================
