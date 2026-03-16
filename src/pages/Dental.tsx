import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SmilePlus, DollarSign, Users, Building2, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useHealthDashboard } from "@/hooks/useHealthDashboard";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Dental() {
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { companyId } = useCompany();

  const { loading, records, competencias, currentCompetencia } = useHealthDashboard(competencia, null);

  const dentalRecords = useMemo(
    () => records.filter((r) => r.tipo_cobertura === "odontologico"),
    [records]
  );

  const summary = useMemo(() => {
    const custoTotal = dentalRecords.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
    const parteEmpresa = dentalRecords.reduce((s, r) => s + (r.parte_empresa || 0), 0);
    const parteColab = dentalRecords.reduce((s, r) => s + (r.parte_colaborador || 0), 0);
    const titulares = dentalRecords.filter((r) => r.parentesco === "titular").length;
    const dependentes = dentalRecords.filter((r) => r.parentesco !== "titular").length;
    const vidas = dentalRecords.length;
    const perCapita = vidas > 0 ? custoTotal / vidas : 0;
    return { custoTotal, parteEmpresa, parteColab, titulares, dependentes, vidas, perCapita };
  }, [dentalRecords]);

  const hasData = dentalRecords.length > 0;

  const competenciaLabel = useMemo(() => {
    if (!currentCompetencia) return "";
    const d = new Date(currentCompetencia + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [currentCompetencia]);

  const handleDeleteImport = async () => {
    if (!currentCompetencia || !companyId) return;
    setDeleting(true);
    try {
      await (supabase.from("health_records" as any) as any)
        .delete()
        .eq("competencia", currentCompetencia)
        .eq("company_id", companyId)
        .eq("tipo_cobertura", "odontologico");
      await (supabase.from("health_invoices" as any) as any)
        .delete()
        .eq("competencia", currentCompetencia)
        .eq("company_id", companyId)
        .eq("fonte", "bradesco_dental");
      toast.success(`Importação dental de ${competenciaLabel} removida. Reimporte o arquivo se necessário.`);
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err?.message ?? "erro"));
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SmilePlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plano Dental</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasData && currentCompetencia && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir importação
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir importação dental</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza? Isso remove {dentalRecords.length} registros odontológicos de{" "}
                    <span className="capitalize font-medium">{competenciaLabel}</span>.
                    Reimporte o arquivo se necessário.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteImport} disabled={deleting}>
                    {deleting ? "Excluindo..." : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {competencias.length > 0 && (
            <Select value={currentCompetencia ?? ""} onValueChange={setCompetencia}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                {competencias.map((c) => {
                  const d = new Date(c + "T00:00:00");
                  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="capitalize">{label}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <SmilePlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">Nenhum dado dental importado</p>
              <p className="text-sm text-muted-foreground">
                Importe uma fatura dental em Benefícios &gt; Importar Fatura para ver os indicadores.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Custo Total Dental
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.custoTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Parte Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.parteEmpresa)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Parte Colaborador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.parteColab)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Vidas Cobertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.vidas}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.titulares} tit. + {summary.dependentes} dep.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Per Capita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.perCapita)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Beneficiaries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Beneficiários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Parentesco</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Mensalidade</TableHead>
                      <TableHead className="text-right">Empresa</TableHead>
                      <TableHead className="text-right">Colaborador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dentalRecords.map((r) => (
                      <TableRow key={r.id} className={r.valor_total < 0 ? "text-destructive" : ""}>
                        <TableCell className="font-medium text-sm">{r.nome_beneficiario}</TableCell>
                        <TableCell>
                          <Badge variant={r.parentesco === "titular" ? "default" : "secondary"} className="text-xs">
                            {r.parentesco}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.codigo_plano}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(r.mensalidade)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(r.parte_empresa)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(r.parte_colaborador)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
