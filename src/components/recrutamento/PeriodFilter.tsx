import { useState, useMemo } from "react";
import { subDays, subMonths, startOfYear, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PeriodPreset = "1m" | "3m" | "6m" | "ano" | "custom" | "todas";

export interface PeriodRange {
  from: Date | null;
  to: Date | null;
}

function presetToRange(preset: PeriodPreset): PeriodRange {
  const now = new Date();
  switch (preset) {
    case "1m": return { from: subMonths(now, 1), to: now };
    case "3m": return { from: subMonths(now, 3), to: now };
    case "6m": return { from: subMonths(now, 6), to: now };
    case "ano": return { from: startOfYear(now), to: now };
    case "todas": return { from: null, to: null };
    default: return { from: subMonths(now, 3), to: now };
  }
}

interface Props {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  className?: string;
}

export function usePeriodFilter(defaultPreset: PeriodPreset = "3m") {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo((): PeriodRange => {
    if (preset === "custom") {
      return { from: customFrom ?? null, to: customTo ?? null };
    }
    return presetToRange(preset);
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

export default function PeriodFilter({
  preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo,
}: {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customFrom?: Date;
  setCustomFrom: (d: Date | undefined) => void;
  customTo?: Date;
  setCustomTo: (d: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
        <SelectTrigger className="w-[170px] bg-card/50 backdrop-blur-sm border-border/50">
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1m">Último mês</SelectItem>
          <SelectItem value="3m">Últimos 3 meses</SelectItem>
          <SelectItem value="6m">Últimos 6 meses</SelectItem>
          <SelectItem value="ano">Ano corrente</SelectItem>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5", !customFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5", !customTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {customTo ? format(customTo, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}

export function filterVagasByPeriod<T extends { data_cadastro: string | null }>(
  vagas: T[],
  range: PeriodRange
): T[] {
  if (!range.from && !range.to) return vagas;
  return vagas.filter(v => {
    if (!v.data_cadastro) return false;
    const d = new Date(v.data_cadastro);
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  });
}
