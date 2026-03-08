import { usePermissions } from "@/hooks/usePermissions";
import { isDiretor } from "@/utils/isDiretor";
import { Lock } from "lucide-react";

interface SalarioProtegidoProps {
  valor: number | null | undefined;
  employee: { cargo?: string | null };
  /** Format override — defaults to BRL currency */
  formatter?: (v: number) => string;
}

function defaultFormat(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SalarioProtegido({ valor, employee, formatter }: SalarioProtegidoProps) {
  const { canView } = usePermissions();
  const protegido = isDiretor(employee) && !canView("salario_diretoria");

  if (protegido) {
    return (
      <div className="relative group inline-flex items-center">
        <span className="filter blur-md select-none pointer-events-none text-muted-foreground">
          R$ XX.XXX,XX
        </span>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <span className="bg-foreground/80 text-background text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shadow-lg">
            <Lock className="h-3 w-3" />
            Restrito - Solicite acesso ao Admin
          </span>
        </div>
      </div>
    );
  }

  const fmt = formatter ?? defaultFormat;
  return <span>{fmt(valor ?? 0)}</span>;
}

/**
 * Hook-level check for whether an employee's salary is restricted for current user.
 */
export function useSalarioRestrito(employee: { cargo?: string | null }): boolean {
  const { canView } = usePermissions();
  return isDiretor(employee) && !canView("salario_diretoria");
}
