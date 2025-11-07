-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  seller_quoted_price DECIMAL(10,2) NOT NULL,
  final_payout DECIMAL(10,2) DEFAULT 0,
  repair_cost DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_valuation',
  current_branch TEXT DEFAULT 'N/A',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Create item_media table for storing item photos/videos
CREATE TABLE public.item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on item_media
ALTER TABLE public.item_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS Policies for items
CREATE POLICY "Users can view all items"
ON public.items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own items"
ON public.items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update their own items"
ON public.items FOR UPDATE
TO authenticated
USING (auth.uid() = seller_id);

CREATE POLICY "Officials can update any item for processing"
ON public.items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  processed_by = auth.uid() OR
  (status = 'sold' AND buyer_id = auth.uid())
);

-- RLS Policies for item_media
CREATE POLICY "Users can view all item media"
ON public.item_media FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert media for their items"
ON public.item_media FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_media.item_id
    AND items.seller_id = auth.uid()
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for items table
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;