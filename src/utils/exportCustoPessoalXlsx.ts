import * as XLSX from "xlsx";
import type { CostBreakdownRow, DeptDetail } from "@/hooks/useCustoPessoal";

function currency(v: number) {
  return Math.round(v * 100) / 100;
}

export function exportCustoPessoalXlsx(
  costBreakdown: CostBreakdownRow[],
  totalGeral: number,
  deptDetails: DeptDetail[],
  mesLabel: string,
  empresa: string,
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 - Componentes
  const compData = costBreakdown.map((r) => ({
    Componente: r.label,
    Valor: currency(r.value),
    "% do Total": `${r.pct.toFixed(1)}%`,
    "Per Capita": currency(r.perCapita),
  }));
  compData.push({
    Componente: "TOTAL",
    Valor: currency(totalGeral),
    "% do Total": "100%",
    "Per Capita": currency(totalGeral),
  });
  const ws1 = XLSX.utils.json_to_sheet(compData);
  XLSX.utils.book_append_sheet(wb, ws1, "Componentes");

  // Sheet 2 - Departamentos
  const deptData = deptDetails.map((d) => ({
    Departamento: d.departamento,
    Colaboradores: d.headcount,
    Salários: currency(d.salarios),
    INSS: currency(d.inss_empresa),
    FGTS: currency(d.fgts),
    "Horas Extras": currency(d.horas_extras),
    "Férias+1/3": currency(d.ferias_terco),
    "13º": currency(d.decimo_terceiro),
    "Conv.Médico": currency(d.convenio_medico),
    Odonto: currency(d.plano_odontologico),
    VT: currency(d.vale_transporte),
    Total: currency(d.total),
  }));
  // Totals row
  const sum = (fn: (d: DeptDetail) => number) => currency(deptDetails.reduce((s, d) => s + fn(d), 0));
  deptData.push({
    Departamento: "TOTAIS",
    Colaboradores: deptDetails.reduce((s, d) => s + d.headcount, 0),
    Salários: sum((d) => d.salarios) as any,
    INSS: sum((d) => d.inss_empresa) as any,
    FGTS: sum((d) => d.fgts) as any,
    "Horas Extras": sum((d) => d.horas_extras) as any,
    "Férias+1/3": sum((d) => d.ferias_terco) as any,
    "13º": sum((d) => d.decimo_terceiro) as any,
    "Conv.Médico": sum((d) => d.convenio_medico) as any,
    Odonto: sum((d) => d.plano_odontologico) as any,
    VT: sum((d) => d.vale_transporte) as any,
    Total: sum((d) => d.total) as any,
  });
  const ws2 = XLSX.utils.json_to_sheet(deptData);
  XLSX.utils.book_append_sheet(wb, ws2, "Departamentos");

  const safeMes = mesLabel.replace(/[\/\s]/g, "_");
  const safeEmpresa = (empresa || "Empresa").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  XLSX.writeFile(wb, `Custo_Pessoal_${safeMes}_${safeEmpresa}.xlsx`);
}
