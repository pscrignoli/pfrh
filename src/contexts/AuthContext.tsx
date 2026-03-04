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
  const mountedRef = useRef(true);
  const roleRequestRef = useRef(0);

  // Separate effect to load roles when user changes
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      return;
    }

    const requestId = ++roleRequestRef.current;

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (!mountedRef.current) return;
        if (roleRequestRef.current !== requestId) return; // stale
        if (error || !data) {
          setRoles([]);
        } else {
          setRoles(data.map((d) => d.role));
        }
      });
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;

    // Synchronous callback — no await inside the listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return;

        if (event === "TOKEN_REFRESHED" && !newSession) {
          toast({
            title: "Sessão expirada",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive",
          });
        }

        setSession(newSession);
        if (!newSession?.user) {
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!mountedRef.current) return;
        setSession(currentSession);
        setLoading(false);
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false);
      });

    const timeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]);
    setLoading(false);
  };

  const role: AppRole | null = roles.find((r) => r !== "super_admin") ?? roles[0] ?? null;

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
