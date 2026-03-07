import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface BirthdayEmployee {
  id: string;
  nome_completo: string;
  departamento: string | null;
  cargo: string | null;
  data_nascimento: string;
  data_admissao: string;
  company_id: string | null;
  dia: number;
  mes: number;
  idade: number;
}

export interface WorkAnniversaryEmployee extends BirthdayEmployee {
  anos_empresa: number;
  is_marco: boolean;
}

const MARCOS = [1, 3, 5, 10, 15, 20, 25, 30];

function calcAge(birthDate: string, refDate: Date = new Date()): number {
  const b = new Date(birthDate);
  let age = refDate.getFullYear() - b.getFullYear();
  const m = refDate.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < b.getDate())) age--;
  return age;
}

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function isWithinNextDays(dateStr: string, days: number, today: Date): boolean {
  const d = new Date(dateStr);
  // Create this year's occurrence
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (thisYear.getTime() - todayStart.getTime()) / 86400000;
  if (diff >= 0 && diff <= days) return true;
  // Handle year boundary
  if (diff < 0) {
    const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    const diff2 = (nextYear.getTime() - todayStart.getTime()) / 86400000;
    return diff2 >= 0 && diff2 <= days;
  }
  return false;
}

function getDaysUntil(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let diff = (thisYear.getTime() - todayStart.getTime()) / 86400000;
  if (diff < 0) {
    const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    diff = (nextYear.getTime() - todayStart.getTime()) / 86400000;
  }
  return Math.round(diff);
}

export function useBirthdayData() {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<BirthdayEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("employees")
      .select("id, nome_completo, departamento, cargo, data_nascimento, data_admissao, company_id")
      .eq("status", "ativo")
      .not("data_nascimento", "is", null);

    if (companyId) query = query.eq("company_id", companyId);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching birthday data:", error);
      setEmployees([]);
    } else {
      const today = new Date();
      const mapped: BirthdayEmployee[] = (data ?? []).map((e: any) => ({
        ...e,
        dia: new Date(e.data_nascimento).getDate(),
        mes: new Date(e.data_nascimento).getMonth() + 1,
        idade: calcAge(e.data_nascimento, today),
      }));
      setEmployees(mapped);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const todayBirthdays = employees.filter(e => e.dia === todayDay && e.mes === todayMonth);

  const next7Days = employees
    .filter(e => isWithinNextDays(e.data_nascimento, 7, today) && !(e.dia === todayDay && e.mes === todayMonth))
    .sort((a, b) => getDaysUntil(a.data_nascimento, today) - getDaysUntil(b.data_nascimento, today));

  const currentMonth = employees
    .filter(e => e.mes === todayMonth)
    .sort((a, b) => a.dia - b.dia);

  const allByMonth: Record<number, BirthdayEmployee[]> = {};
  for (let m = 1; m <= 12; m++) allByMonth[m] = [];
  employees.forEach(e => {
    allByMonth[e.mes] = allByMonth[e.mes] || [];
    allByMonth[e.mes].push(e);
  });
  for (const m of Object.keys(allByMonth)) {
    allByMonth[Number(m)].sort((a, b) => a.dia - b.dia);
  }

  // Work anniversaries
  const workAnniversaries: WorkAnniversaryEmployee[] = employees
    .filter(e => {
      if (!e.data_admissao) return false;
      const admDate = new Date(e.data_admissao);
      return admDate.getMonth() + 1 === todayMonth;
    })
    .map(e => {
      const admDate = new Date(e.data_admissao);
      const anos = today.getFullYear() - admDate.getFullYear();
      return {
        ...e,
        anos_empresa: anos,
        is_marco: MARCOS.includes(anos),
      };
    })
    .sort((a, b) => new Date(a.data_admissao).getDate() - new Date(b.data_admissao).getDate());

  // Next 7 days work anniversaries
  const workNext7Days: WorkAnniversaryEmployee[] = employees
    .filter(e => e.data_admissao && isWithinNextDays(e.data_admissao, 7, today))
    .map(e => {
      const admDate = new Date(e.data_admissao);
      const anos = today.getFullYear() - admDate.getFullYear();
      // If the anniversary hasn't happened yet this year, it's still the previous count
      const thisYearAnniv = new Date(today.getFullYear(), admDate.getMonth(), admDate.getDate());
      const finalAnos = thisYearAnniv <= today ? anos : anos;
      return {
        ...e,
        anos_empresa: finalAnos,
        is_marco: MARCOS.includes(finalAnos),
      };
    })
    .sort((a, b) => getDaysUntil(a.data_admissao, today) - getDaysUntil(b.data_admissao, today));

  // Age distribution
  const ageDistribution = {
    "18-25": employees.filter(e => e.idade >= 18 && e.idade <= 25).length,
    "26-35": employees.filter(e => e.idade >= 26 && e.idade <= 35).length,
    "36-45": employees.filter(e => e.idade >= 36 && e.idade <= 45).length,
    "46-55": employees.filter(e => e.idade >= 46 && e.idade <= 55).length,
    "56+": employees.filter(e => e.idade >= 56).length,
  };

  const averageAge = employees.length > 0
    ? Math.round(employees.reduce((sum, e) => sum + e.idade, 0) / employees.length)
    : 0;

  // Monthly counts for chart
  const monthlyCount = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: new Date(2000, i).toLocaleString("pt-BR", { month: "short" }),
    count: allByMonth[i + 1]?.length ?? 0,
  }));

  // Department distribution
  const deptMap = new Map<string, number>();
  employees.forEach(e => {
    const dept = e.departamento || "Sem departamento";
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
  });
  const deptDistribution = Array.from(deptMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    loading,
    employees,
    todayBirthdays,
    next7Days,
    currentMonth,
    allByMonth,
    workAnniversaries,
    workNext7Days,
    ageDistribution,
    averageAge,
    monthlyCount,
    deptDistribution,
    todayMonth,
    todayDay,
    getDaysUntil: (dateStr: string) => getDaysUntil(dateStr, today),
  };
}
