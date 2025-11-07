-- Allow users to insert their own role during signup
-- This policy only allows inserting if the user doesn't already have any role
CREATE POLICY "Users can insert own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

-- Also allow users to update their role if they need to change it
-- (only if they're changing their own role)
CREATE POLICY "Users can update own role"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);