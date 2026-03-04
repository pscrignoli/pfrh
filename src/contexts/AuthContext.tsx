import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  roles: [],
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string): Promise<AppRole[]> => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (error || !data) return [];
        return data.map((d) => d.role);
      } catch {
        return [];
      }
    };

    const handleSession = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const userRoles = await loadRoles(s.user.id);
        if (mounted) setRoles(userRoles);
      } else {
        setRoles([]);
      }
      if (mounted) setLoading(false);
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Skip INITIAL_SESSION — handled via getSession
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED" && !newSession) {
          setSession(null);
          setRoles([]);
          setLoading(false);
          toast({
            title: "Sessão expirada",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive",
          });
          return;
        }

        await handleSession(newSession);
      }
    );

    // Get initial session (only once)
    if (!initialized.current) {
      initialized.current = true;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        handleSession(s);
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    }

    // Safety timeout: never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[Auth] Safety timeout triggered — forcing loading=false");
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setSession(null);
    setRoles([]);
    await supabase.auth.signOut();
  };

  const role: AppRole | null = roles.find(r => r !== "super_admin") ?? roles[0] ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        roles,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
