-- ============================================
-- COMPLETE DATABASE RESET AND REBUILD SCRIPT
-- E-Waste Management Platform with Crypto Payments
-- ============================================
-- WARNING: This will DELETE ALL DATA and rebuild from scratch
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop all existing tables and types
DROP TABLE IF EXISTS public.crypto_transactions CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.item_media CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop storage bucket
DELETE FROM storage.buckets WHERE id = 'item-media';

-- ============================================
-- Step 2: Create Types and Enums
-- ============================================

CREATE TYPE app_role AS ENUM ('user', 'official');

-- ============================================
-- Step 3: Create Tables
-- ============================================

-- User Roles Table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Profiles Table (with crypto wallet fields)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  wallet_address TEXT,
  is_crypto_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Items Table (with ETH price fields)
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Item Media Table
CREATE TABLE public.item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- System Configuration Table
CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Crypto Transactions Table
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
  confirmed_at TIMESTAMPTZ
);

-- ============================================
-- Step 4: Create Functions
-- ============================================

-- Function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND user_roles.role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Step 5: Create Triggers
-- ============================================

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for items updated_at
DROP TRIGGER IF EXISTS set_updated_at_items ON public.items;
CREATE TRIGGER set_updated_at_items
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for system_config updated_at
DROP TRIGGER IF EXISTS set_updated_at_system_config ON public.system_config;
CREATE TRIGGER set_updated_at_system_config
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Step 6: Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 7: Create RLS Policies
-- ============================================

-- User Roles Policies
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Officials can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Items Policies
CREATE POLICY "Users can view own items"
ON public.items FOR SELECT
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Officials can view all items"
ON public.items FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Users can insert own items"
ON public.items FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Officials can update items"
ON public.items FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Users can purchase items"
ON public.items FOR UPDATE
USING (status = 'ready_to_sell' AND auth.uid() IS NOT NULL);

-- Item Media Policies
CREATE POLICY "Media viewable by item participants"
ON public.item_media FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_media.item_id
    AND (items.seller_id = auth.uid() OR items.buyer_id = auth.uid() OR public.has_role(auth.uid(), 'official'))
  )
);

CREATE POLICY "Users can insert media for own items"
ON public.item_media FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_media.item_id
    AND items.seller_id = auth.uid()
  )
);

-- System Config Policies
CREATE POLICY "Anyone can view system config"
ON public.system_config FOR SELECT
USING (true);

CREATE POLICY "Officials can update system config"
ON public.system_config FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Officials can insert system config"
ON public.system_config FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'official'));

-- Crypto Transactions Policies
CREATE POLICY "Users can view their own transactions"
ON public.crypto_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = crypto_transactions.item_id
    AND (items.seller_id = auth.uid() OR items.buyer_id = auth.uid())
  )
);

CREATE POLICY "Officials can view all transactions"
ON public.crypto_transactions FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Officials can insert transactions"
ON public.crypto_transactions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'official'));

CREATE POLICY "System can update transaction status"
ON public.crypto_transactions FOR UPDATE
USING (true);

-- ============================================
-- Step 8: Create Storage Bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-media', 'item-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-media');

DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
CREATE POLICY "Users can upload own media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'item-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'item-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (bucket_id = 'item-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- Step 9: Insert Default Data
-- ============================================

-- Insert default exchange rate (1 ETH = Rs 250,000)
INSERT INTO public.system_config (config_key, config_value, description)
VALUES ('rs_to_eth_rate', '250000', 'Exchange rate: 1 ETH = Rs X')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- Step 10: Add Comments
-- ============================================

COMMENT ON COLUMN public.profiles.wallet_address IS 'Ethereum wallet address (42 characters, starts with 0x)';
COMMENT ON COLUMN public.profiles.is_crypto_verified IS 'Whether the wallet address has been verified';
COMMENT ON TABLE public.crypto_transactions IS 'Logs all crypto payment transactions';
COMMENT ON TABLE public.system_config IS 'System-wide configuration including exchange rates';

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Your database is now ready with:
-- ✅ All tables created
-- ✅ Crypto payment support enabled
-- ✅ RLS policies configured
-- ✅ Storage bucket ready
-- ✅ Default exchange rate set
-- ============================================
