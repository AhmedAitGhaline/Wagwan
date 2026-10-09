-- WAGWAN V20: live-schema-compatible Moroccan phone normalization for Number Promo Leads.
-- Safe replacement: preserves existing function signatures and rows; does not issue coupons.

CREATE OR REPLACE FUNCTION public.normalize_moroccan_phone(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  digits text;
  local_number text;
BEGIN
  IF p_input IS NULL OR pg_catalog.btrim(p_input) = '' THEN
    RETURN NULL;
  END IF;

  digits := pg_catalog.translate(
    pg_catalog.btrim(p_input),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
  digits := pg_catalog.regexp_replace(digits, '[^0-9]', '', 'g');

  IF pg_catalog.left(digits, 2) = '00' THEN
    digits := pg_catalog.substr(digits, 3);
  END IF;

  IF pg_catalog.left(digits, 3) = '212' THEN
    local_number := pg_catalog.substr(digits, 4);
    IF pg_catalog.left(local_number, 1) = '0' THEN
      local_number := pg_catalog.substr(local_number, 2);
    END IF;
    IF local_number ~ '^[67][0-9]{8}$' THEN
      RETURN '212' || local_number;
    END IF;
    RETURN NULL;
  END IF;

  IF digits ~ '^0[67][0-9]{8}$' THEN
    RETURN '212' || pg_catalog.substr(digits, 2);
  END IF;
  IF digits ~ '^[67][0-9]{8}$' THEN
    RETURN '212' || digits;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_welcome_discount(
  p_visitor_id text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_phone text;
  v_is_checkout_lead boolean;
  v_lead_type text;
  v_already_claimed boolean := false;
  v_existing public.welcome_discount_claims%ROWTYPE;
BEGIN
  IF p_visitor_id IS NULL OR pg_catalog.btrim(p_visitor_id) = '' THEN
    RAISE EXCEPTION 'Visitor ID missing';
  END IF;

  v_phone := public.normalize_moroccan_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Invalid Moroccan phone number';
  END IF;

  -- Serialize claims for the same canonical number to avoid simultaneous duplicates.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_phone)::bigint);

  SELECT EXISTS (
    SELECT 1 FROM public.checkout_leads
    WHERE visitor_id = p_visitor_id
      AND status IN ('active', 'abandoned')
  ) INTO v_is_checkout_lead;

  v_lead_type := CASE WHEN v_is_checkout_lead THEN 'checkout' ELSE 'number_promo' END;

  -- Match a prior claim by visitor OR canonical phone, even if an old row used another format.
  SELECT c.* INTO v_existing
  FROM public.welcome_discount_claims AS c
  WHERE c.visitor_id = pg_catalog.btrim(p_visitor_id)
     OR public.normalize_moroccan_phone(c.phone) = v_phone
  LIMIT 1;

  IF FOUND THEN
    v_already_claimed := true;
    v_phone := COALESCE(public.normalize_moroccan_phone(v_existing.phone), v_phone);
  ELSE
    INSERT INTO public.welcome_discount_claims (visitor_id, phone)
    VALUES (pg_catalog.btrim(p_visitor_id), v_phone)
    ON CONFLICT (visitor_id) DO UPDATE
      SET phone = EXCLUDED.phone,
          updated_at = pg_catalog.now();
  END IF;

  -- The deployed schema supplied by the user uses analytics_visitors.last_seen.
  INSERT INTO public.analytics_visitors (visitor_id, phone, last_seen)
  VALUES (pg_catalog.btrim(p_visitor_id), v_phone, pg_catalog.now())
  ON CONFLICT (visitor_id) DO UPDATE
    SET phone = EXCLUDED.phone,
        last_seen = pg_catalog.now();

  UPDATE public.wagwan_cart_sessions
  SET phone = v_phone,
      lead_type = v_lead_type,
      last_activity_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE visitor_id = pg_catalog.btrim(p_visitor_id)
    AND status <> 'converted'
    AND order_id IS NULL;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'already_claimed', v_already_claimed,
    'visitor_id', pg_catalog.btrim(p_visitor_id),
    'phone', v_phone,
    'lead_type', v_lead_type,
    'manual_code', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_moroccan_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_moroccan_phone(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_welcome_discount(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_welcome_discount(text, text) TO anon, authenticated;

-- Run separately after the migration to verify normalization:
-- SELECT input_phone, public.normalize_moroccan_phone(input_phone) AS normalized_phone
-- FROM (VALUES ('0612345678'), ('612345678'), ('+212612345678'),
-- ('212612345678'), ('00212612345678'), ('2120612345678'),
-- ('06 12 34 56 78'), ('0712345678'), ('712345678'), ('061234567')) AS t(input_phone);
