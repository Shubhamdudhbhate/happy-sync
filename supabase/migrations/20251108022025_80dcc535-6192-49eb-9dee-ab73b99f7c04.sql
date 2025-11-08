-- Allow buyers to purchase items that are ready to sell
CREATE POLICY "Users can purchase ready to sell items"
ON public.items
FOR UPDATE
USING (status = 'ready_to_sell')
WITH CHECK (status = 'sold' AND auth.uid() = buyer_id);