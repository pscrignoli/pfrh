import { Users, DollarSign, AlertTriangle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/useDashboardData";
import { PayrollEvolutionChart } from "@/components/dashboard/PayrollEvolutionChart";
import { CostDistributionChart } from "@/components/dashboard/CostDistributionChart";
import { BirthdayWidget } from "@/components/dashboard/BirthdayWidget";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Dashboard() {
  const { headcount, custoTotalFolha, horasExtras, evolucaoFolha, distribuicaoCustos, loading } =
    useDashboardData();

  const kpis = [
    {
      title: "Headcount Ativo",
      value: loading ? null : String(headcount),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Custo Total da Folha",
      value: loading ? null : formatCurrency(custoTotalFolha),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Horas Extras (Mês)",
      value: loading ? null : `${horasExtras.toLocaleString("pt-BR")}h`,
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Risco Preditivo",
      value: "Em breve",
      subtitle: "Turnover / Burnout",
      icon: Brain,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
      placeholder: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
        <p className="text-muted-foreground">Visão geral executiva da gestão de pessoas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {kpi.value === null ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + Birthday Widget */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Evolução da Folha de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <PayrollEvolutionChart data={evolucaoFolha} />
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <BirthdayWidget />
        </div>
      </div>

      {/* Cost Distribution */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <CostDistributionChart data={distribuicaoCustos} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
