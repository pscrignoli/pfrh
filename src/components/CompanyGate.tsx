import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyGate({ children }: { children: React.ReactNode }) {
  const { companyId, companies, setCompanyId, loading } = useCompany();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-80">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Selecione a empresa</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha a empresa para continuar no sistema.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {companies.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full h-14 justify-start gap-3 text-base"
                onClick={() => setCompanyId(c.id)}
              >
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{c.name}</div>
                  {c.cnpj && (
                    <div className="text-xs text-muted-foreground">{c.cnpj}</div>
                  )}
                </div>
              </Button>
            ))}
            {companies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma empresa cadastrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
