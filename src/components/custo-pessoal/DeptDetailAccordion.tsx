import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Users } from "lucide-react";
import { DeptDetail } from "@/hooks/useCustoPessoal";

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

interface Props {
  deptDetails: DeptDetail[];
  mesLabel: string;
}

interface ComponentRow {
  label: string;
  value: number;
  pctDept: number;
}

function getComponents(d: DeptDetail): ComponentRow[] {
  const total = d.total || 1;
  const items = [
    { label: "Salários", value: d.salarios },
    { label: "INSS Empresa", value: d.inss_empresa },
    { label: "FGTS", value: d.fgts },
    { label: "Horas Extras", value: d.horas_extras },
    { label: "Férias + 1/3", value: d.ferias_terco },
    { label: "13º Salário", value: d.decimo_terceiro },
    { label: "Convênio Médico", value: d.convenio_medico },
    { label: "Plano Odontológico", value: d.plano_odontologico },
    { label: "Vale Transporte", value: d.vale_transporte },
    { label: "Insalubridade", value: d.insalubridade },
    { label: "Adicional Noturno", value: d.adicional_noturno },
  ].filter(i => i.value > 0);
  return items.map(i => ({ ...i, pctDept: (i.value / total) * 100 }));
}

export default function DeptDetailAccordion({ deptDetails, mesLabel }: Props) {
  const grandTotal = useMemo(() => deptDetails.reduce((s, d) => s + d.total, 0), [deptDetails]);

  if (deptDetails.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Detalhamento por Departamento</CardTitle>
        <p className="text-xs text-muted-foreground">{mesLabel}</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {deptDetails.map((dept) => {
          const pctTotal = grandTotal > 0 ? (dept.total / grandTotal) * 100 : 0;
          return (
            <Collapsible key={dept.departamento}>
              <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors group">
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                <span className="font-medium flex-1 text-left">{dept.departamento}</span>
                {/* Progress bar */}
                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${Math.min(pctTotal, 100)}%` }}
                  />
                </div>
                <span className="tabular-nums font-semibold text-right min-w-[110px]">
                  {currency(dept.total)}
                </span>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {dept.headcount}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 mr-3 mb-3 mt-1 border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Componente</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs text-right">% do Depto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getComponents(dept).map((c) => (
                        <TableRow key={c.label}>
                          <TableCell className="text-xs py-1.5">{c.label}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-1.5">{currency(c.value)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-1.5">{pct(c.pctDept)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold border-t">
                        <TableCell className="text-xs py-1.5">TOTAL</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-1.5">{currency(dept.total)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-1.5">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
