import { Briefcase, Users, UserCheck, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  total: number;
  candidatosEmProcesso: number;
  posicoes: number;
  contratados: number;
}

export default function RecrutamentoStats({ total, candidatosEmProcesso, posicoes, contratados }: Props) {
  const items = [
    { label: "Total Vagas", value: total, icon: Briefcase, color: "text-primary" },
    { label: "Candidatos em Processo", value: candidatosEmProcesso, icon: UserPlus, color: "text-info" },
    { label: "Posições Abertas", value: posicoes, icon: Users, color: "text-warning" },
    { label: "Contratados", value: contratados, icon: UserCheck, color: "text-chart-4" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
