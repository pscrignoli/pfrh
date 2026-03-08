import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { type ReactNode } from "react";

interface ModuleGuardProps {
  module: string;
  children: ReactNode;
}

export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { canView, loading, userProfile } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  // No profile yet - allow dashboard, block everything else
  if (!userProfile?.role_id && module !== "dashboard") {
    return <Navigate to="/acesso-negado" replace />;
  }

  // Has profile but no permission for this module
  if (userProfile?.role_id && !canView(module)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
