import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

export default function AccessDenied() {
  const navigate = useNavigate();
  const { roleName } = usePermissions();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center p-8">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar este módulo.
          Solicite acesso ao administrador do sistema.
        </p>
        {roleName && (
          <p className="text-sm text-muted-foreground">
            Seu perfil: <strong>{roleName}</strong>
          </p>
        )}
      </div>
      <Button onClick={() => navigate("/")}>Voltar ao Dashboard</Button>
    </div>
  );
}
