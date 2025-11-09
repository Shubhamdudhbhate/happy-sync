-- Add crypto wallet fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wallet_address TEXT,
ADD COLUMN IF NOT EXISTS is_crypto_verified BOOLEAN DEFAULT FALSE;

-- Add ETH values to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS seller_quoted_price_eth DECIMAL(18,8),
ADD COLUMN IF NOT EXISTS final_payout_eth DECIMAL(18,8),
ADD COLUMN IF NOT EXISTS repair_cost_eth DECIMAL(18,8),
ADD COLUMN IF NOT EXISTS selling_price_eth DECIMAL(18,8);

-- Create system configuration table for exchange rate
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- System config policies
CREATE POLICY "Anyone can view system config"
ON public.system_config FOR SELECT
USING (true);

CREATE POLICY "Officials can update system config"
ON public.system_config FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Officials can insert system config"
ON public.system_config FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'official'));

-- Insert default exchange rate (1 ETH = Rs 250,000)
INSERT INTO public.system_config (config_key, config_value, description)
VALUES ('rs_to_eth_rate', '250000', 'Exchange rate: 1 ETH = Rs X')
ON CONFLICT (config_key) DO NOTHING;

-- Create transaction logs table for crypto transactions
CREATE TABLE IF NOT EXISTS public.crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'payout' or 'purchase'
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_rs DECIMAL(10,2) NOT NULL,
  amount_eth DECIMAL(18,8) NOT NULL,
  exchange_rate DECIMAL(10,2) NOT NULL,
  transaction_hash TEXT, -- Simulated transaction hash
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Enable RLS on crypto_transactions
ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

-- Crypto transactions policies
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

-- Add trigger to update system_config updated_at
CREATE TRIGGER set_updated_at_system_config
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add comment for wallet address validation
COMMENT ON COLUMN public.profiles.wallet_address IS 'Ethereum wallet address (42 characters, starts with 0x)';
COMMENT ON COLUMN public.profiles.is_crypto_verified IS 'Whether the wallet address has been verified';
