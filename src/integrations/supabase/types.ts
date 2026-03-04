export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      candidates: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          vacancy_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      document_embeddings: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          source_document: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_document?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_document?: string | null
        }
        Relationships: []
      }
      employee_positions: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          is_current: boolean | null
          position_id: string
          salary: number
          start_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          position_id: string
          salary: number
          start_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          position_id?: string
          salary?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_positions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          cargo: string | null
          created_at: string
          ctps: string | null
          data_admissao: string
          data_nascimento: string | null
          departamento: string | null
          email_holerite: string | null
          empresa: string | null
          genero: Database["public"]["Enums"]["gender_type"] | null
          grau_parentesco: string | null
          id: string
          jornada_semanal: number | null
          matricula_esocial: string | null
          matricula_interna: string | null
          nome_completo: string
          nome_contato_emergencia: string | null
          numero_cpf: string
          numero_pis_nit: string | null
          numero_rg: string | null
          status: Database["public"]["Enums"]["employee_status"]
          telefone: string | null
          telefone_emergencia: string | null
          tipo_contrato: Database["public"]["Enums"]["contract_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          ctps?: string | null
          data_admissao: string
          data_nascimento?: string | null
          departamento?: string | null
          email_holerite?: string | null
          empresa?: string | null
          genero?: Database["public"]["Enums"]["gender_type"] | null
          grau_parentesco?: string | null
          id?: string
          jornada_semanal?: number | null
          matricula_esocial?: string | null
          matricula_interna?: string | null
          nome_completo: string
          nome_contato_emergencia?: string | null
          numero_cpf: string
          numero_pis_nit?: string | null
          numero_rg?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          ctps?: string | null
          data_admissao?: string
          data_nascimento?: string | null
          departamento?: string | null
          email_holerite?: string | null
          empresa?: string | null
          genero?: Database["public"]["Enums"]["gender_type"] | null
          grau_parentesco?: string | null
          id?: string
          jornada_semanal?: number | null
          matricula_esocial?: string | null
          matricula_interna?: string | null
          nome_completo?: string
          nome_contato_emergencia?: string | null
          numero_cpf?: string
          numero_pis_nit?: string | null
          numero_rg?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string
          direction: string
          endpoint: string | null
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          source: string
          status: Database["public"]["Enums"]["integration_status"]
        }
        Insert: {
          created_at?: string
          direction: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          source: string
          status?: Database["public"]["Enums"]["integration_status"]
        }
        Update: {
          created_at?: string
          direction?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          source?: string
          status?: Database["public"]["Enums"]["integration_status"]
        }
        Relationships: []
      }
      payroll_monthly_records: {
        Row: {
          adicional_noturno: number | null
          admissao: string | null
          ajuda_de_custo: number | null
          ano: number
          area: string | null
          auxilio_alimentacao: number | null
          avos_ferias: number | null
          beneficios: number | null
          bonus_gratificacao: number | null
          cargo: string | null
          centro_custo: string | null
          codigo_centro_custo: string | null
          contrato_empregado: string | null
          convenio_medico: number | null
          created_at: string
          decimo_terceiro: number | null
          desconto_vale_transporte: number | null
          desligamento: string | null
          diferenca_salario: number | null
          dsr_horas: number | null
          employee_id: string
          empresa: string | null
          encargos: number | null
          falta: number | null
          ferias: number | null
          ferias_13: number | null
          fgts_13: number | null
          fgts_8: number | null
          fgts_ferias: number | null
          he_total: number | null
          hora_100: number | null
          hora_50: number | null
          hora_60: number | null
          hora_80: number | null
          id: string
          insalubridade: number | null
          inss_13: number | null
          inss_20: number | null
          inss_ferias: number | null
          mes: number
          plano_odontologico: number | null
          plano_odontologico_empresa: number | null
          relacao_funcionarios: string | null
          salario: number | null
          salario_base: number | null
          salario_familia: number | null
          salario_gratificacao: number | null
          soma: number | null
          status: string | null
          terco_ferias: number | null
          tipo_contrato: Database["public"]["Enums"]["contract_type"] | null
          total_folha: number | null
          total_geral: number | null
          updated_at: string
          vale_transporte: number | null
          vr_alimentacao: number | null
          vr_auto: number | null
        }
        Insert: {
          adicional_noturno?: number | null
          admissao?: string | null
          ajuda_de_custo?: number | null
          ano: number
          area?: string | null
          auxilio_alimentacao?: number | null
          avos_ferias?: number | null
          beneficios?: number | null
          bonus_gratificacao?: number | null
          cargo?: string | null
          centro_custo?: string | null
          codigo_centro_custo?: string | null
          contrato_empregado?: string | null
          convenio_medico?: number | null
          created_at?: string
          decimo_terceiro?: number | null
          desconto_vale_transporte?: number | null
          desligamento?: string | null
          diferenca_salario?: number | null
          dsr_horas?: number | null
          employee_id: string
          empresa?: string | null
          encargos?: number | null
          falta?: number | null
          ferias?: number | null
          ferias_13?: number | null
          fgts_13?: number | null
          fgts_8?: number | null
          fgts_ferias?: number | null
          he_total?: number | null
          hora_100?: number | null
          hora_50?: number | null
          hora_60?: number | null
          hora_80?: number | null
          id?: string
          insalubridade?: number | null
          inss_13?: number | null
          inss_20?: number | null
          inss_ferias?: number | null
          mes: number
          plano_odontologico?: number | null
          plano_odontologico_empresa?: number | null
          relacao_funcionarios?: string | null
          salario?: number | null
          salario_base?: number | null
          salario_familia?: number | null
          salario_gratificacao?: number | null
          soma?: number | null
          status?: string | null
          terco_ferias?: number | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"] | null
          total_folha?: number | null
          total_geral?: number | null
          updated_at?: string
          vale_transporte?: number | null
          vr_alimentacao?: number | null
          vr_auto?: number | null
        }
        Update: {
          adicional_noturno?: number | null
          admissao?: string | null
          ajuda_de_custo?: number | null
          ano?: number
          area?: string | null
          auxilio_alimentacao?: number | null
          avos_ferias?: number | null
          beneficios?: number | null
          bonus_gratificacao?: number | null
          cargo?: string | null
          centro_custo?: string | null
          codigo_centro_custo?: string | null
          contrato_empregado?: string | null
          convenio_medico?: number | null
          created_at?: string
          decimo_terceiro?: number | null
          desconto_vale_transporte?: number | null
          desligamento?: string | null
          diferenca_salario?: number | null
          dsr_horas?: number | null
          employee_id?: string
          empresa?: string | null
          encargos?: number | null
          falta?: number | null
          ferias?: number | null
          ferias_13?: number | null
          fgts_13?: number | null
          fgts_8?: number | null
          fgts_ferias?: number | null
          he_total?: number | null
          hora_100?: number | null
          hora_50?: number | null
          hora_60?: number | null
          hora_80?: number | null
          id?: string
          insalubridade?: number | null
          inss_13?: number | null
          inss_20?: number | null
          inss_ferias?: number | null
          mes?: number
          plano_odontologico?: number | null
          plano_odontologico_empresa?: number | null
          relacao_funcionarios?: string | null
          salario?: number | null
          salario_base?: number | null
          salario_familia?: number | null
          salario_gratificacao?: number | null
          soma?: number | null
          status?: string | null
          terco_ferias?: number | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"] | null
          total_folha?: number | null
          total_geral?: number | null
          updated_at?: string
          vale_transporte?: number | null
          vr_alimentacao?: number | null
          vr_auto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_monthly_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          base_salary: number | null
          created_at: string
          department: string | null
          id: string
          title: string
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          department?: string | null
          id?: string
          title: string
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          department?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      time_records: {
        Row: {
          break_end: string | null
          break_start: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          employee_id: string
          external_id: string | null
          id: string
          night_hours: number | null
          overtime_hours: number | null
          record_date: string
          source: string | null
          total_hours: number | null
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id: string
          external_id?: string | null
          id?: string
          night_hours?: number | null
          overtime_hours?: number | null
          record_date: string
          source?: string | null
          total_hours?: number | null
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          external_id?: string | null
          id?: string
          night_hours?: number | null
          overtime_hours?: number | null
          record_date?: string
          source?: string | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacancies: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          status: Database["public"]["Enums"]["vacancy_status"]
          title: string
          work_model: Database["public"]["Enums"]["work_model"]
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["vacancy_status"]
          title: string
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["vacancy_status"]
          title?: string
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_candidate_stage: {
        Args: {
          _candidate_id: string
          _stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin_rh"
        | "gestor_financeiro"
        | "assistente_dp"
        | "super_admin"
      candidate_stage:
        | "novos"
        | "triagem"
        | "entrevista_rh"
        | "entrevista_gestor"
        | "aprovado"
      contract_type: "clt" | "pj" | "estagio" | "temporario" | "aprendiz"
      employee_status: "ativo" | "inativo" | "ferias" | "afastado" | "desligado"
      gender_type: "masculino" | "feminino" | "outro" | "nao_informado"
      integration_status: "pending" | "success" | "error"
      vacancy_status: "aberta" | "pausada" | "fechada"
      work_model: "presencial" | "hibrido" | "remoto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin_rh",
        "gestor_financeiro",
        "assistente_dp",
        "super_admin",
      ],
      candidate_stage: [
        "novos",
        "triagem",
        "entrevista_rh",
        "entrevista_gestor",
        "aprovado",
      ],
      contract_type: ["clt", "pj", "estagio", "temporario", "aprendiz"],
      employee_status: ["ativo", "inativo", "ferias", "afastado", "desligado"],
      gender_type: ["masculino", "feminino", "outro", "nao_informado"],
      integration_status: ["pending", "success", "error"],
      vacancy_status: ["aberta", "pausada", "fechada"],
      work_model: ["presencial", "hibrido", "remoto"],
    },
  },
} as const
