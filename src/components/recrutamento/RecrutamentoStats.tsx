import { Users, UserCheck, UserPlus, Briefcase, TrendingUp } from "lucide-react";

interface Props {
  total: number;
  candidatosEmProcesso: number;
  posicoes: number;
  contratados: number;
}

export default function RecrutamentoStats({ total, candidatosEmProcesso, posicoes, contratados }: Props) {
  const items = [
    { label: "Vagas", value: total, icon: Briefcase, color: "text-primary" },
    { label: "Posições Abertas", value: posicoes, icon: TrendingUp, color: "text-warning" },
    { label: "Em Processo", value: candidatosEmProcesso, icon: UserPlus, color: "text-info" },
    { label: "Contratados", value: contratados, icon: UserCheck, color: "text-success" },
  ];

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
          <div className={`p-1.5 rounded-md bg-muted/80 ${item.color}`}>
            <item.icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xl font-bold tabular-nums">{item.value}</span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
