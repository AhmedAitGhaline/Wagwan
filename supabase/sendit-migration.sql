-- WAGWAN × SENDIT — DELIVERY / TRACKING MIGRATION
-- Run once in Supabase SQL Editor.
-- Secrets NEVER belong in this file.

CREATE TABLE IF NOT EXISTS public.delivery_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier text NOT NULL DEFAULT 'sendit' CHECK (carrier = 'sendit'),
  sendit_code text UNIQUE,
  sendit_reference text,
  sendit_status text NOT NULL DEFAULT 'PENDING',
  internal_status text NOT NULL DEFAULT 'created'
    CHECK (internal_status IN ('created','picked_up','in_transit','warehouse','distributed','delivering','delivered','exception')),
  district_id integer,
  pickup_district_id integer,
  packaging_id integer,
  allow_open boolean NOT NULL DEFAULT true,
  allow_try boolean NOT NULL DEFAULT true,
  sendit_fee numeric(12,2),
  label_url text,
  last_action_at_text text,
  proof_image_url text,
  deliver_by text,
  counter_unreachable integer,
  raw_last_payload jsonb,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_shipments_order ON public.delivery_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_shipments_code ON public.delivery_shipments(sendit_code);
CREATE INDEX IF NOT EXISTS idx_delivery_shipments_status ON public.delivery_shipments(internal_status);

CREATE TABLE IF NOT EXISTS public.delivery_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.delivery_shipments(id) ON DELETE CASCADE,
  sendit_code text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  last_action_at_text text,
  message text,
  proof_image_url text,
  deliver_by text,
  counter_unreachable integer,
  raw_payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_events_shipment ON public.delivery_tracking_events(shipment_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_events_code ON public.delivery_tracking_events(sendit_code, received_at DESC);

ALTER TABLE public.delivery_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage delivery shipments" ON public.delivery_shipments;
CREATE POLICY "Admins can manage delivery shipments"
ON public.delivery_shipments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Admins can read delivery events" ON public.delivery_tracking_events;
CREATE POLICY "Admins can read delivery events"
ON public.delivery_tracking_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_shipments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tracking_events TO service_role;

-- Keep updated_at current when rows are changed from the dashboard.
CREATE OR REPLACE FUNCTION public.touch_delivery_shipments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_shipments_updated_at ON public.delivery_shipments;
CREATE TRIGGER trg_delivery_shipments_updated_at
BEFORE UPDATE ON public.delivery_shipments
FOR EACH ROW EXECUTE FUNCTION public.touch_delivery_shipments_updated_at();

-- Optional helper for the Admin UI / reporting.
CREATE OR REPLACE VIEW public.delivery_tracking_overview AS
SELECT
  ds.id,
  ds.order_id,
  ds.sendit_code,
  ds.sendit_reference,
  ds.sendit_status,
  ds.internal_status,
  ds.sendit_fee,
  ds.label_url,
  ds.last_action_at_text,
  ds.proof_image_url,
  ds.deliver_by,
  ds.counter_unreachable,
  ds.picked_up_at,
  ds.delivered_at,
  ds.updated_at
FROM public.delivery_shipments ds;

GRANT SELECT ON public.delivery_tracking_overview TO authenticated, service_role;
