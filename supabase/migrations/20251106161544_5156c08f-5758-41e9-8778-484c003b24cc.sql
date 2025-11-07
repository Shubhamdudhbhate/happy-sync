-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'official');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  seller_quoted_price DECIMAL(10,2) NOT NULL,
  final_payout DECIMAL(10,2) DEFAULT 0,
  repair_cost DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_valuation',
  current_branch TEXT DEFAULT 'N/A',
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Create item_media table for photos/videos
CREATE TABLE public.item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on item_media
ALTER TABLE public.item_media ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for item media
INSERT INTO storage.buckets (id, name, public) VALUES ('item-media', 'item-media', true);

-- Storage policies for item media
CREATE POLICY "Anyone can view item media"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-media');

CREATE POLICY "Authenticated users can upload item media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-media' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own item media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Officials can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

-- Items policies
CREATE POLICY "Users can view their own items as seller"
ON public.items FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Users can view items ready to sell"
ON public.items FOR SELECT
USING (status = 'ready_to_sell');

CREATE POLICY "Officials can view all items"
ON public.items FOR SELECT
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Users can insert items"
ON public.items FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Officials can update items"
ON public.items FOR UPDATE
USING (public.has_role(auth.uid(), 'official'));

CREATE POLICY "Users can purchase items"
ON public.items FOR UPDATE
USING (
  auth.uid() = buyer_id 
  AND status = 'ready_to_sell'
);

-- Item media policies
CREATE POLICY "Anyone can view item media"
ON public.item_media FOR SELECT
USING (true);

CREATE POLICY "Item sellers can insert media"
ON public.item_media FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_id
    AND items.seller_id = auth.uid()
  )
);

CREATE POLICY "Item sellers can delete their media"
ON public.item_media FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_id
    AND items.seller_id = auth.uid()
  )
);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN new;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_items
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();