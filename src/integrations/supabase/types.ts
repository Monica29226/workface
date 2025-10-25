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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string
          company_id: string | null
          details: string | null
          id: string
          log_id: string
          target_email: string | null
          timestamp: string
        }
        Insert: {
          action: string
          actor_email: string
          company_id?: string | null
          details?: string | null
          id?: string
          log_id: string
          target_email?: string | null
          timestamp?: string
        }
        Update: {
          action?: string
          actor_email?: string
          company_id?: string | null
          details?: string | null
          id?: string
          log_id?: string
          target_email?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_type"]
          company_id: string
          created_at: string
          display_name: string
          iban: string | null
          id: string
          logo_url: string | null
          payroll_email_from: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: Database["public"]["Enums"]["currency_type"]
          company_id: string
          created_at?: string
          display_name: string
          iban?: string | null
          id?: string
          logo_url?: string | null
          payroll_email_from?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_type"]
          company_id?: string
          created_at?: string
          display_name?: string
          iban?: string | null
          id?: string
          logo_url?: string | null
          payroll_email_from?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aguinaldo_base_12m: number | null
          base_salary: number
          company_id: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          employee_id: string
          full_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
          vac_balance_days: number | null
          work_email: string
        }
        Insert: {
          aguinaldo_base_12m?: number | null
          base_salary: number
          company_id: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          employee_id: string
          full_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          vac_balance_days?: number | null
          work_email: string
        }
        Update: {
          aguinaldo_base_12m?: number | null
          base_salary?: number
          company_id?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          employee_id?: string
          full_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          vac_balance_days?: number | null
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_batches: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_type"]
          batch_id: string
          company_id: string
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["payroll_frequency"]
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payroll_batch_status"] | null
          updated_at: string
        }
        Insert: {
          base_currency?: Database["public"]["Enums"]["currency_type"]
          batch_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          frequency: Database["public"]["Enums"]["payroll_frequency"]
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payroll_batch_status"] | null
          updated_at?: string
        }
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_type"]
          batch_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["payroll_frequency"]
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payroll_batch_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          aguinaldo_accrued: number | null
          batch_id: string
          company_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          deductions: number | null
          employee_id: string
          employer_contrib: number | null
          exchange_rate_to_base: number | null
          gross_salary: number
          id: string
          line_id: string
          net_pay: number
          notes: string | null
          overtime: number | null
          project_hours_amount: number | null
          updated_at: string
          vacation_accrued_days: number | null
        }
        Insert: {
          aguinaldo_accrued?: number | null
          batch_id: string
          company_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          deductions?: number | null
          employee_id: string
          employer_contrib?: number | null
          exchange_rate_to_base?: number | null
          gross_salary: number
          id?: string
          line_id: string
          net_pay: number
          notes?: string | null
          overtime?: number | null
          project_hours_amount?: number | null
          updated_at?: string
          vacation_accrued_days?: number | null
        }
        Update: {
          aguinaldo_accrued?: number | null
          batch_id?: string
          company_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          deductions?: number | null
          employee_id?: string
          employer_contrib?: number | null
          exchange_rate_to_base?: number | null
          gross_salary?: number
          id?: string
          line_id?: string
          net_pay?: number
          notes?: string | null
          overtime?: number | null
          project_hours_amount?: number | null
          updated_at?: string
          vacation_accrued_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          batch_id: string
          company_id: string
          created_at: string
          employee_email: string
          employee_id: string
          id: string
          payslip_id: string
          pdf_file_path: string | null
          period_label: string
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          company_id: string
          created_at?: string
          employee_email: string
          employee_id: string
          id?: string
          payslip_id: string
          pdf_file_path?: string | null
          period_label: string
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          company_id?: string
          created_at?: string
          employee_email?: string
          employee_id?: string
          id?: string
          payslip_id?: string
          pdf_file_path?: string | null
          period_label?: string
          sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          hourly_rate: number | null
          id: string
          internal_code: string | null
          name: string
          project_id: string
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          hourly_rate?: number | null
          id?: string
          internal_code?: string | null
          name: string
          project_id: string
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          hourly_rate?: number | null
          id?: string
          internal_code?: string | null
          name?: string
          project_id?: string
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved: boolean | null
          company_id: string
          created_at: string
          employee_id: string
          entry_date: string
          hours: number
          id: string
          notes: string | null
          project_id: string
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          company_id: string
          created_at?: string
          employee_id: string
          entry_date: string
          hours: number
          id?: string
          notes?: string | null
          project_id: string
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          company_id?: string
          created_at?: string
          employee_id?: string
          entry_date?: string
          hours?: number
          id?: string
          notes?: string | null
          project_id?: string
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "company_manager" | "employee"
      contract_type: "mensual" | "por_horas"
      currency_type: "CRC" | "USD" | "EUR" | "GBP"
      employee_status: "activo" | "inactivo"
      payroll_batch_status: "borrador" | "calculado" | "aprobado" | "enviado"
      payroll_frequency: "semanal" | "quincenal" | "mensual"
      project_status: "activo" | "cerrado"
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
      app_role: ["admin", "company_manager", "employee"],
      contract_type: ["mensual", "por_horas"],
      currency_type: ["CRC", "USD", "EUR", "GBP"],
      employee_status: ["activo", "inactivo"],
      payroll_batch_status: ["borrador", "calculado", "aprobado", "enviado"],
      payroll_frequency: ["semanal", "quincenal", "mensual"],
      project_status: ["activo", "cerrado"],
    },
  },
} as const
