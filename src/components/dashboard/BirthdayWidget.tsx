import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Cake, ChevronDown, ChevronUp, Award } from "lucide-react";
import { useBirthdayData, type BirthdayEmployee, type WorkAnniversaryEmployee } from "@/hooks/useBirthdayData";

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function BirthdayRow({ emp, highlight, badge }: { emp: BirthdayEmployee; highlight?: boolean; badge?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-3 py-2 px-2 rounded-md transition-colors hover:bg-muted/50 ${highlight ? "bg-primary/5" : ""}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">{getInitials(emp.nome_completo)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{emp.nome_completo}</p>
            <p className="text-xs text-muted-foreground truncate">{emp.departamento || "—"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <Badge variant="secondary" className="text-[10px] border-0 bg-primary/10 text-primary">{badge}</Badge>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {String(emp.dia).padStart(2, "0")}/{String(emp.mes).padStart(2, "0")} · {emp.idade} anos
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p className="text-xs"><strong>{emp.cargo || "Sem cargo"}</strong></p>
        <p className="text-xs">{emp.departamento || "Sem departamento"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function WorkAnniversaryRow({ emp }: { emp: WorkAnniversaryEmployee }) {
  const admDay = new Date(emp.data_admissao).getDate();
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50">
      <Award className={`h-4 w-4 shrink-0 ${emp.is_marco ? "text-warning" : "text-muted-foreground"}`} />
      <p className="text-sm flex-1 truncate">{emp.nome_completo}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        {emp.is_marco && (
          <Badge variant="secondary" className="text-[10px] border-0 bg-warning/10 text-warning">🏆 {emp.anos_empresa} anos!</Badge>
        )}
        <span className="text-xs text-muted-foreground">{String(admDay).padStart(2, "0")}/{String(new Date(emp.data_admissao).getMonth() + 1).padStart(2, "0")} · {emp.anos_empresa}a</span>
      </div>
    </div>
  );
}

export function BirthdayWidget() {
  const {
    loading, todayBirthdays, next7Days, currentMonth, workNext7Days,
    todayMonth, todayDay, getDaysUntil,
  } = useBirthdayData();
  const [showAllMonth, setShowAllMonth] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Cake className="h-4 w-4" /> Aniversariantes</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  const hasTodayBirthday = todayBirthdays.length > 0;

  return (
    <Card className={hasTodayBirthday ? "ring-1 ring-primary/20 shadow-lg shadow-primary/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${hasTodayBirthday ? "bg-primary/15" : "bg-muted"}`}>
            <Cake className={`h-4 w-4 ${hasTodayBirthday ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          Aniversariantes
          <Badge variant="outline" className="ml-auto text-[10px]">
            {currentMonth.length} em {MONTH_NAMES[todayMonth - 1]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Today */}
        {hasTodayBirthday && (
          <div className="rounded-lg bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-3 border border-primary/10 birthday-today-card">
            <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
              🎂 Hoje
            </p>
            {todayBirthdays.map(emp => (
              <BirthdayRow key={emp.id} emp={emp} highlight />
            ))}
          </div>
        )}

        {/* Next 7 days */}
        {next7Days.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 px-2">Próximos 7 dias</p>
            {next7Days.map(emp => {
              const days = getDaysUntil(emp.data_nascimento);
              const badge = days === 1 ? "Amanhã" : undefined;
              return <BirthdayRow key={emp.id} emp={emp} badge={badge} />;
            })}
          </div>
        )}

        {/* Work anniversaries next 7 days */}
        {workNext7Days.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 px-2">Tempo de casa (próx. 7 dias)</p>
            {workNext7Days.slice(0, 3).map(emp => (
              <WorkAnniversaryRow key={emp.id} emp={emp} />
            ))}
          </div>
        )}

        {/* Month expand */}
        {currentMonth.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setShowAllMonth(!showAllMonth)}
            >
              {showAllMonth ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {showAllMonth ? "Recolher" : `Ver todos de ${MONTH_NAMES[todayMonth - 1]} (${currentMonth.length})`}
            </Button>
            {showAllMonth && (
              <div className="mt-1 max-h-[300px] overflow-y-auto">
                {currentMonth.map(emp => {
                  const isToday = emp.dia === todayDay;
                  return <BirthdayRow key={emp.id} emp={emp} highlight={isToday} badge={isToday ? "Hoje" : undefined} />;
                })}
              </div>
            )}
          </div>
        )}

        {todayBirthdays.length === 0 && next7Days.length === 0 && currentMonth.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversariante este mês.</p>
        )}
      </CardContent>
    </Card>
  );
}
