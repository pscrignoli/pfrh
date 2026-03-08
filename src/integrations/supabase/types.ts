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
      candidate_field_values: {
        Row: {
          candidate_id: string
          field_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          candidate_id: string
          field_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          candidate_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_field_values_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "vacancy_fields"
            referencedColumns: ["id"]
          },
        ]
      }
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
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          razao_social: string | null
          status: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          razao_social?: string | null
          status?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          razao_social?: string | null
          status?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          empregare_setor_id: number | null
          id: string
          name: string
          status: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          empregare_setor_id?: number | null
          id?: string
          name: string
          status?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          empregare_setor_id?: number | null
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          cadastro_completo: boolean | null
          cargo: string | null
          cbo: string | null
          company_id: string | null
          created_at: string
          ctps: string | null
          cursando: boolean | null
          data_admissao: string
          data_demissao: string | null
          data_nascimento: string | null
          departamento: string | null
          dependentes_ir: number | null
          dependentes_sf: number | null
          email_holerite: string | null
          empregare_pessoa_id: number | null
          empresa: string | null
          formacao_academica: string | null
          genero: Database["public"]["Enums"]["gender_type"] | null
          grau_escolaridade: string | null
          grau_parentesco: string | null
          id: string
          jornada_semanal: number | null
          matricula_esocial: string | null
          matricula_interna: string | null
          nome_completo: string
          nome_contato_emergencia: string | null
          numero_cpf: string | null
          numero_funcional: string | null
          numero_pis_nit: string | null
          numero_rg: string | null
          salario_base: number | null
          sindicato_codigo: string | null
          status: Database["public"]["Enums"]["employee_status"]
          telefone: string | null
          telefone_emergencia: string | null
          tipo_contrato: Database["public"]["Enums"]["contract_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cadastro_completo?: boolean | null
          cargo?: string | null
          cbo?: string | null
          company_id?: string | null
          created_at?: string
          ctps?: string | null
          cursando?: boolean | null
          data_admissao: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_ir?: number | null
          dependentes_sf?: number | null
          email_holerite?: string | null
          empregare_pessoa_id?: number | null
          empresa?: string | null
          formacao_academica?: string | null
          genero?: Database["public"]["Enums"]["gender_type"] | null
          grau_escolaridade?: string | null
          grau_parentesco?: string | null
          id?: string
          jornada_semanal?: number | null
          matricula_esocial?: string | null
          matricula_interna?: string | null
          nome_completo: string
          nome_contato_emergencia?: string | null
          numero_cpf?: string | null
          numero_funcional?: string | null
          numero_pis_nit?: string | null
          numero_rg?: string | null
          salario_base?: number | null
          sindicato_codigo?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cadastro_completo?: boolean | null
          cargo?: string | null
          cbo?: string | null
          company_id?: string | null
          created_at?: string
          ctps?: string | null
          cursando?: boolean | null
          data_admissao?: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_ir?: number | null
          dependentes_sf?: number | null
          email_holerite?: string | null
          empregare_pessoa_id?: number | null
          empresa?: string | null
          formacao_academica?: string | null
          genero?: Database["public"]["Enums"]["gender_type"] | null
          grau_escolaridade?: string | null
          grau_parentesco?: string | null
          id?: string
          jornada_semanal?: number | null
          matricula_esocial?: string | null
          matricula_interna?: string | null
          nome_completo?: string
          nome_contato_emergencia?: string | null
          numero_cpf?: string | null
          numero_funcional?: string | null
          numero_pis_nit?: string | null
          numero_rg?: string | null
          salario_base?: number | null
          sindicato_codigo?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      empregare_candidatos: {
        Row: {
          cidade: string | null
          company_id: string | null
          curriculo_json: Json | null
          curriculo_url: string | null
          data_contratacao: string | null
          data_sync: string | null
          email: string | null
          empregare_pessoa_id: number
          empregare_vaga_id: number | null
          estado: string | null
          etapa_atual: string | null
          id: string
          marcadores: Json | null
          nome: string | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          company_id?: string | null
          curriculo_json?: Json | null
          curriculo_url?: string | null
          data_contratacao?: string | null
          data_sync?: string | null
          email?: string | null
          empregare_pessoa_id: number
          empregare_vaga_id?: number | null
          estado?: string | null
          etapa_atual?: string | null
          id?: string
          marcadores?: Json | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          company_id?: string | null
          curriculo_json?: Json | null
          curriculo_url?: string | null
          data_contratacao?: string | null
          data_sync?: string | null
          email?: string | null
          empregare_pessoa_id?: number
          empregare_vaga_id?: number | null
          estado?: string | null
          etapa_atual?: string | null
          id?: string
          marcadores?: Json | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empregare_candidatos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empregare_candidatos_empregare_vaga_id_fkey"
            columns: ["empregare_vaga_id"]
            isOneToOne: false
            referencedRelation: "empregare_vagas"
            referencedColumns: ["empregare_id"]
          },
        ]
      }
      empregare_company_map: {
        Row: {
          company_id: string | null
          created_at: string | null
          empregare_filial_id: number
          empregare_titulo: string | null
          empregare_unidade_id: number
          id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          empregare_filial_id: number
          empregare_titulo?: string | null
          empregare_unidade_id: number
          id?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          empregare_filial_id?: number
          empregare_titulo?: string | null
          empregare_unidade_id?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empregare_company_map_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      empregare_kanban_cards: {
        Row: {
          company_id: string | null
          created_at: string | null
          data_entrada_etapa: string | null
          email: string | null
          empregare_pessoa_id: number | null
          empregare_vaga_id: number
          etapa_atual: string
          etapa_ordem: number | null
          id: string
          nome: string
          observacao: string | null
          origem: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          data_entrada_etapa?: string | null
          email?: string | null
          empregare_pessoa_id?: number | null
          empregare_vaga_id: number
          etapa_atual: string
          etapa_ordem?: number | null
          id?: string
          nome: string
          observacao?: string | null
          origem?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          data_entrada_etapa?: string | null
          email?: string | null
          empregare_pessoa_id?: number | null
          empregare_vaga_id?: number
          etapa_atual?: string
          etapa_ordem?: number | null
          id?: string
          nome?: string
          observacao?: string | null
          origem?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empregare_kanban_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      empregare_vagas: {
        Row: {
          beneficios: Json | null
          cidade: string | null
          company_id: string | null
          data_cadastro: string | null
          data_sync: string | null
          department_id: string | null
          descricao: string | null
          empregare_id: number
          estado: string | null
          etapas: Json | null
          horario: string | null
          id: string
          meta_encerramento: string | null
          raw_json: Json | null
          requisicao_id: number | null
          requisitos: string | null
          responsaveis: Json | null
          salario_combinar: boolean | null
          salario_max: number | null
          salario_min: number | null
          situacao: string | null
          tipo_recrutamento: string | null
          titulo: string | null
          total_vagas: number | null
          trabalho_remoto: string | null
        }
        Insert: {
          beneficios?: Json | null
          cidade?: string | null
          company_id?: string | null
          data_cadastro?: string | null
          data_sync?: string | null
          department_id?: string | null
          descricao?: string | null
          empregare_id: number
          estado?: string | null
          etapas?: Json | null
          horario?: string | null
          id?: string
          meta_encerramento?: string | null
          raw_json?: Json | null
          requisicao_id?: number | null
          requisitos?: string | null
          responsaveis?: Json | null
          salario_combinar?: boolean | null
          salario_max?: number | null
          salario_min?: number | null
          situacao?: string | null
          tipo_recrutamento?: string | null
          titulo?: string | null
          total_vagas?: number | null
          trabalho_remoto?: string | null
        }
        Update: {
          beneficios?: Json | null
          cidade?: string | null
          company_id?: string | null
          data_cadastro?: string | null
          data_sync?: string | null
          department_id?: string | null
          descricao?: string | null
          empregare_id?: number
          estado?: string | null
          etapas?: Json | null
          horario?: string | null
          id?: string
          meta_encerramento?: string | null
          raw_json?: Json | null
          requisicao_id?: number | null
          requisitos?: string | null
          responsaveis?: Json | null
          salario_combinar?: boolean | null
          salario_max?: number | null
          salario_min?: number | null
          situacao?: string | null
          tipo_recrutamento?: string | null
          titulo?: string | null
          total_vagas?: number | null
          trabalho_remoto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empregare_vagas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empregare_vagas_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          abono_pecuniario: boolean
          adiantamento_13: boolean
          company_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dias_abono: number
          dias_gozo: number
          employee_id: string
          id: string
          observacao: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status: string
          updated_at: string
          valor_bruto: number | null
          valor_inss: number | null
          valor_irrf: number | null
          valor_liquido: number | null
        }
        Insert: {
          abono_pecuniario?: boolean
          adiantamento_13?: boolean
          company_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_abono?: number
          dias_gozo?: number
          employee_id: string
          id?: string
          observacao?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status?: string
          updated_at?: string
          valor_bruto?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_liquido?: number | null
        }
        Update: {
          abono_pecuniario?: boolean
          adiantamento_13?: boolean
          company_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_abono?: number
          dias_gozo?: number
          employee_id?: string
          id?: string
          observacao?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          status?: string
          updated_at?: string
          valor_bruto?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "integration_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "payroll_monthly_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          created_at: string
          department: string | null
          id: string
          title: string
        }
        Insert: {
          base_salary?: number | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          title: string
        }
        Update: {
          base_salary?: number | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rescisao_simulacoes: {
        Row: {
          company_id: string | null
          created_at: string
          data_demissao: string
          data_simulacao: string
          employee_id: string
          id: string
          simulado_por: string | null
          tipo_rescisao: string
          valores_json: Json
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data_demissao: string
          data_simulacao?: string
          employee_id: string
          id?: string
          simulado_por?: string | null
          tipo_rescisao: string
          valores_json?: Json
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data_demissao?: string
          data_simulacao?: string
          employee_id?: string
          id?: string
          simulado_por?: string | null
          tipo_rescisao?: string
          valores_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rescisao_simulacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rescisao_simulacoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          id: string
          module: string
          role_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module: string
          role_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
        ]
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
      user_profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          role_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
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
          company_id: string | null
          created_at: string
          department_id: string | null
          id: string
          opened_at: string | null
          status: Database["public"]["Enums"]["vacancy_status"]
          title: string
          work_model: Database["public"]["Enums"]["work_model"]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title: string
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title?: string
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          label: string
          options: Json | null
          sort_order: number
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          label: string
          options?: Json | null
          sort_order?: number
          vacancy_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          sort_order?: number
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_fields_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      vaga_descricoes: {
        Row: {
          aprovada: boolean | null
          beneficios: Json | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          departamento: string | null
          descricao_html: string
          descricao_ia_original: string | null
          empregare_vaga_id: number | null
          faixa_salarial_max: number | null
          faixa_salarial_min: number | null
          fonte: string | null
          id: string
          modalidade: string | null
          nivel_hierarquico: string | null
          nivel_ingles: string | null
          normas_regulatorias: Json | null
          requisitos_html: string | null
          titulo_cargo: string
          updated_at: string | null
        }
        Insert: {
          aprovada?: boolean | null
          beneficios?: Json | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          departamento?: string | null
          descricao_html: string
          descricao_ia_original?: string | null
          empregare_vaga_id?: number | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          fonte?: string | null
          id?: string
          modalidade?: string | null
          nivel_hierarquico?: string | null
          nivel_ingles?: string | null
          normas_regulatorias?: Json | null
          requisitos_html?: string | null
          titulo_cargo: string
          updated_at?: string | null
        }
        Update: {
          aprovada?: boolean | null
          beneficios?: Json | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          departamento?: string | null
          descricao_html?: string
          descricao_ia_original?: string | null
          empregare_vaga_id?: number | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          fonte?: string | null
          id?: string
          modalidade?: string | null
          nivel_hierarquico?: string | null
          nivel_ingles?: string | null
          normas_regulatorias?: Json | null
          requisitos_html?: string | null
          titulo_cargo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaga_descricoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_vacancy_cascade: {
        Args: { _vacancy_id: string }
        Returns: undefined
      }
      get_user_role_name: { Args: { _user_id: string }; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      save_vacancy_fields: {
        Args: { _fields: Json; _vacancy_id: string }
        Returns: undefined
      }
      update_candidate_info: {
        Args: {
          _candidate_id: string
          _email: string
          _name: string
          _phone: string
          _stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Returns: undefined
      }
      update_candidate_stage: {
        Args: {
          _candidate_id: string
          _stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Returns: undefined
      }
      update_vacancy_info: {
        Args: {
          _department_id: string
          _opened_at: string
          _status: Database["public"]["Enums"]["vacancy_status"]
          _title: string
          _vacancy_id: string
          _work_model: Database["public"]["Enums"]["work_model"]
        }
        Returns: undefined
      }
      upsert_candidate_field_values: {
        Args: { _candidate_id: string; _values: Json }
        Returns: undefined
      }
      user_can_edit_module: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_module: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
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
