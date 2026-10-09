-- WAGWAN email automation for COD orders
-- Adds an idempotency/log table and an INSERT webhook trigger.

CREATE TABLE IF NOT EXISTS public.email_order_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  message_id text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_order_confirmations_order
  ON public.email_order_confirmations(order_id);

ALTER TABLE public.email_order_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage email confirmations"
  ON public.email_order_confirmations;

CREATE POLICY "Admins can manage email confirmations"
  ON public.email_order_confirmations
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_order_confirmations TO service_role;

DROP TRIGGER IF EXISTS wagwan_order_email_webhook ON public.orders;

CREATE TRIGGER wagwan_order_email_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://pjxdaiqnvunjaasmmten.supabase.co/functions/v1/wagwan-order-email',
  'POST',
  '{"Content-Type":"application/json","x-wagwan-webhook-secret":"TON_SECRET_ICI"}',
  '{}',
  '5000'
);
