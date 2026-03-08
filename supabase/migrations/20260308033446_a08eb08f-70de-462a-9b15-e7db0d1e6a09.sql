
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(300) NOT NULL,
  full_name VARCHAR(300),
  role_id UUID REFERENCES public.role_definitions(id),
  company_id UUID REFERENCES public.companies(id),
  invited_by UUID NOT NULL,
  user_id UUID,
  status VARCHAR(20) DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_invite_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'Invalid invite status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_invite_status_trigger
  BEFORE INSERT OR UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_status();

-- RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read invites" ON public.user_invites
  FOR SELECT USING (
    get_user_role_name(auth.uid()) IN ('super_admin', 'admin')
  );

CREATE POLICY "Admins can insert invites" ON public.user_invites
  FOR INSERT WITH CHECK (
    get_user_role_name(auth.uid()) IN ('super_admin', 'admin')
  );

CREATE POLICY "Admins can update invites" ON public.user_invites
  FOR UPDATE USING (
    get_user_role_name(auth.uid()) IN ('super_admin', 'admin')
  );
