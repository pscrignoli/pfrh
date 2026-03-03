import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Employee, EmployeeInsert } from "@/hooks/useEmployees";
import { Constants } from "@/integrations/supabase/types";
import { useDepartments } from "@/hooks/useDepartments";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  nome_completo: z.string().trim().min(1, "Nome é obrigatório").max(200),
  numero_cpf: z.string().trim().min(11, "CPF inválido").max(14),
  data_nascimento: z.string().optional().nullable(),
  numero_rg: z.string().optional().nullable(),
  genero: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email_holerite: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  nome_contato_emergencia: z.string().optional().nullable(),
  grau_parentesco: z.string().optional().nullable(),
  telefone_emergencia: z.string().optional().nullable(),
  empresa: z.string().optional().nullable(),
  departamento: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  matricula_interna: z.string().optional().nullable(),
  matricula_esocial: z.string().optional().nullable(),
  data_admissao: z.string().min(1, "Data de admissão é obrigatória"),
  ctps: z.string().optional().nullable(),
  numero_pis_nit: z.string().optional().nullable(),
  tipo_contrato: z.string().default("clt"),
  jornada_semanal: z.coerce.number().optional().nullable(),
  status: z.string().default("ativo"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onSave: (data: EmployeeInsert) => Promise<void>;
  onUpdate: (id: string, data: Partial<EmployeeInsert>) => Promise<void>;
}

export function EmployeeFormDialog({ open, onClose, employee, onSave, onUpdate }: Props) {
  const isEdit = !!employee;
  const { departments } = useDepartments(true);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: employee
      ? {
          ...employee,
          data_nascimento: employee.data_nascimento ?? "",
          data_admissao: employee.data_admissao,
          jornada_semanal: employee.jornada_semanal ? Number(employee.jornada_semanal) : 44,
          email_holerite: employee.email_holerite ?? "",
        }
      : {
          nome_completo: "",
          numero_cpf: "",
          data_admissao: new Date().toISOString().split("T")[0],
          tipo_contrato: "clt",
          status: "ativo",
          jornada_semanal: 44,
        },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        email_holerite: values.email_holerite || null,
        genero: (values.genero || null) as EmployeeInsert["genero"],
        tipo_contrato: values.tipo_contrato as EmployeeInsert["tipo_contrato"],
        status: values.status as EmployeeInsert["status"],
      };

      if (isEdit) {
        await onUpdate(employee!.id, payload);
        toast({ title: "Colaborador atualizado com sucesso." });
      } else {
        await onSave(payload as EmployeeInsert);
        toast({ title: "Colaborador cadastrado com sucesso." });
      }
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="pessoais" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
                <TabsTrigger value="contato">Contato / Emergência</TabsTrigger>
                <TabsTrigger value="contrato">Contrato / Admissão</TabsTrigger>
              </TabsList>

              {/* Tab 1 - Personal */}
              <TabsContent value="pessoais" className="space-y-4 mt-4">
                <FormField control={form.control} name="nome_completo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="numero_cpf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="numero_rg" render={({ field }) => (
                    <FormItem>
                      <FormLabel>RG</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="data_nascimento" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="genero" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gênero</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Constants.public.Enums.gender_type.map((g) => (
                            <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1).replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              {/* Tab 2 - Contact */}
              <TabsContent value="contato" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email_holerite" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail Holerite</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Contato de Emergência</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="nome_contato_emergencia" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="grau_parentesco" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parentesco</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="telefone_emergencia" render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Telefone de Emergência</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              {/* Tab 3 - Contract */}
              <TabsContent value="contrato" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="empresa" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="departamento" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cargo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="data_admissao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Admissão *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="matricula_interna" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula Interna</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="matricula_esocial" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula e-Social</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ctps" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CTPS</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="numero_pis_nit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIS / NIT</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="tipo_contrato" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Contrato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Constants.public.Enums.contract_type.map((c) => (
                            <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="jornada_semanal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jornada (h/sem)</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? 44} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Constants.public.Enums.employee_status.map((s) => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">{isEdit ? "Salvar Alterações" : "Cadastrar"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
