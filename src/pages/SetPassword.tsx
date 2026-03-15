import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, CheckCircle2, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        settled = true;
        setReady(true);
        setChecking(false);
        if (session?.user) {
          setRoleName(session.user.user_metadata?.role || null);
          setUserName(session.user.user_metadata?.full_name || null);
        }
      }
    });

    // Check current session - user may already be signed in via invite link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;
      if (session?.user) {
        settled = true;
        setReady(true);
        setChecking(false);
        setRoleName(session.user.user_metadata?.role || null);
        setUserName(session.user.user_metadata?.full_name || null);
      }
    });

    // Check hash fragments
    const hash = window.location.hash;
    if (hash.includes("type=invite") || hash.includes("type=recovery") || hash.includes("type=magiclink")) {
      // Wait a moment for Supabase to process the hash
      setTimeout(() => {
        if (!settled) {
          settled = true;
          setReady(true);
          setChecking(false);
        }
      }, 2000);
    } else {
      // No relevant hash - give a brief window then show invalid
      setTimeout(() => {
        if (!settled) {
          settled = true;
          setChecking(false);
        }
      }, 3000);
    }

    return () => {
      settled = true;
      subscription.unsubscribe();
    };
  }, []);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const allValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setError(null);
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Mark invite as accepted via edge function (avoids CORS PATCH issue)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await supabase.functions.invoke("invite-user", {
          headers: { Authorization: `Bearer ${currentSession?.access_token}` },
          body: {
            action: "accept",
            email: user.email,
          },
        });
      } catch {
        // Non-critical: invite status update failed but password was set successfully
      }
    }

    setSuccess(true);
    setLoading(false);
    toast({ title: `Bem-vindo, ${userName || ""}! Seu acesso está configurado.` });
    setTimeout(() => navigate("/", { replace: true }), 2000);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <CardTitle className="text-xl">Verificando convite...</CardTitle>
            <CardDescription>Aguarde enquanto validamos seu link.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl">Link inválido</CardTitle>
            <CardDescription>
              Este link de convite é inválido ou já expirou. Solicite um novo convite ao administrador.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate("/login")}>Ir para Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Senha criada com sucesso!</CardTitle>
            <CardDescription>Redirecionando para o sistema...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const Req = ({ ok, text }: { ok: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "text-green-700" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            RH
          </div>
          <CardTitle className="text-xl">Bem-vindo ao Gestão de RH</CardTitle>
          <CardDescription>Crie sua senha para começar</CardDescription>
          {roleName && (
            <p className="text-sm text-muted-foreground">
              Você foi convidado como <span className="font-semibold text-primary">{roleName}</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nova Senha</Label>
              <Input
                id="new-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <div className="space-y-1 mt-2">
                <Req ok={hasMinLength} text="Mínimo 8 caracteres" />
                <Req ok={hasUppercase} text="Pelo menos 1 letra maiúscula" />
                <Req ok={hasNumber} text="Pelo menos 1 número" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmar Senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPassword && (
                <Req ok={passwordsMatch} text={passwordsMatch ? "Senhas coincidem" : "Senhas não coincidem"} />
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!allValid || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar senha e acessar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
