import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Award } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useEmployees } from "@/hooks/useEmployees";

const GRAU_ORDER = ["ensino_medio", "tecnico", "superior", "pos_mba", "mestrado", "doutorado", "pos_doutorado"];

const grauLabels: Record<string, string> = {
  ensino_medio: "Ensino Médio",
  tecnico: "Técnico",
  superior: "Superior",
  pos_mba: "Pós/MBA",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  pos_doutorado: "Pós Doutorado",
};

const grauChartColors: Record<string, string> = {
  ensino_medio: "hsl(220, 10%, 65%)",
  tecnico: "hsl(187, 70%, 45%)",
  superior: "hsl(142, 60%, 45%)",
  pos_mba: "hsl(217, 70%, 50%)",
  mestrado: "hsl(270, 60%, 55%)",
  doutorado: "hsl(40, 80%, 50%)",
  pos_doutorado: "hsl(35, 90%, 45%)",
};

export function AcademicProfileWidget() {
  const { employees } = useEmployees({ search: "", status: "ativo", departamento: null });

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let cursandoCount = 0;

    for (const emp of employees) {
      const ext = emp as any;
      const grau = ext.grau_escolaridade;
      if (grau && grauLabels[grau]) {
        counts[grau] = (counts[grau] || 0) + 1;
      }
      if (ext.cursando) cursandoCount++;
    }

    const chartData = GRAU_ORDER
      .filter((g) => counts[g])
      .map((g) => ({ name: grauLabels[g], value: counts[g], key: g }));

    // Most common
    let mostCommon = "";
    let maxCount = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > maxCount) { maxCount = v; mostCommon = k; }
    }

    // Highest level
    let highest = "";
    for (const g of [...GRAU_ORDER].reverse()) {
      if (counts[g]) { highest = g; break; }
    }
    const highestCount = highest ? counts[highest] : 0;

    return { chartData, cursandoCount, mostCommon, highest, highestCount, total: employees.length };
  }, [employees]);

  if (stats.chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Perfil Acadêmico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {stats.chartData.map((entry) => (
                  <Cell key={entry.key} fill={grauChartColors[entry.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} colaboradores`, ""]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-yellow-50 p-2">
            <BookOpen className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
            <p className="text-lg font-bold text-yellow-700">{stats.cursandoCount}</p>
            <p className="text-xs text-muted-foreground">Cursando</p>
          </div>
          <div className="rounded-lg bg-green-50 p-2">
            <GraduationCap className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <p className="text-sm font-bold text-green-700">{grauLabels[stats.mostCommon] ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Mais comum</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <Award className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <p className="text-sm font-bold text-amber-700">{grauLabels[stats.highest] ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{stats.highestCount} colab.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
