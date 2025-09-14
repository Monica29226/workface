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
      companies: {
        Row: {
          accent_color: string | null
          active: boolean | null
          created_at: string | null
          id: string
          juridical_id: string
          legal_name: string
          light_color: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean | null
          created_at?: string | null
          id?: string
          juridical_id: string
          legal_name: string
          light_color?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean | null
          created_at?: string | null
          id?: string
          juridical_id?: string
          legal_name?: string
          light_color?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_users: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
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
        ]
      }
      contracts: {
        Row: {
          base_salary: number
          commissions: number | null
          company_id: string | null
          contract_type: string
          created_at: string | null
          currency: string | null
          employee_id: string | null
          end_date: string | null
          holiday_rate: number | null
          id: string
          max_weekly_hours: number | null
          night_rate: number | null
          overtime_rate: number | null
          payment_period: string
          schedule_text: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          workday_type: string
        }
        Insert: {
          base_salary: number
          commissions?: number | null
          company_id?: string | null
          contract_type?: string
          created_at?: string | null
          currency?: string | null
          employee_id?: string | null
          end_date?: string | null
          holiday_rate?: number | null
          id?: string
          max_weekly_hours?: number | null
          night_rate?: number | null
          overtime_rate?: number | null
          payment_period?: string
          schedule_text?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          workday_type?: string
        }
        Update: {
          base_salary?: number
          commissions?: number | null
          company_id?: string | null
          contract_type?: string
          created_at?: string | null
          currency?: string | null
          employee_id?: string | null
          end_date?: string | null
          holiday_rate?: number | null
          id?: string
          max_weekly_hours?: number | null
          night_rate?: number | null
          overtime_rate?: number | null
          payment_period?: string
          schedule_text?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          workday_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean | null
          code: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean | null
          birth_date: string | null
          cedula: string
          children_count: number | null
          civil_status: string | null
          company_id: string | null
          cost_center: string | null
          created_at: string | null
          department: string | null
          email: string | null
          first_name: string
          has_garnishment: boolean | null
          has_pension: boolean | null
          hire_date: string
          iban: string | null
          id: string
          last_name: string
          manager_id: string | null
          nss_ccss: string | null
          payment_currency: string | null
          phone: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          birth_date?: string | null
          cedula: string
          children_count?: number | null
          civil_status?: string | null
          company_id?: string | null
          cost_center?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name: string
          has_garnishment?: boolean | null
          has_pension?: boolean | null
          hire_date: string
          iban?: string | null
          id?: string
          last_name: string
          manager_id?: string | null
          nss_ccss?: string | null
          payment_currency?: string | null
          phone?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          birth_date?: string | null
          cedula?: string
          children_count?: number | null
          civil_status?: string | null
          company_id?: string | null
          cost_center?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name?: string
          has_garnishment?: boolean | null
          has_pension?: boolean | null
          hire_date?: string
          iban?: string | null
          id?: string
          last_name?: string
          manager_id?: string | null
          nss_ccss?: string | null
          payment_currency?: string | null
          phone?: string | null
          termination_date?: string | null
          updated_at?: string | null
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
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          company_id: string | null
          created_at: string | null
          end_date: string
          exchange_rate: number | null
          id: string
          name: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          end_date: string
          exchange_rate?: number | null
          id?: string
          name: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          end_date?: string
          exchange_rate?: number | null
          id?: string
          name?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          aguinaldo: number | null
          company_id: string | null
          created_at: string | null
          employee_id: string | null
          gross_salary: number
          id: string
          net_salary: number
          notes: string | null
          period_id: string | null
          salary_retention: number | null
          social_charges: number | null
          status: string | null
          updated_at: string | null
          vacations_amount: number | null
        }
        Insert: {
          aguinaldo?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          gross_salary: number
          id?: string
          net_salary: number
          notes?: string | null
          period_id?: string | null
          salary_retention?: number | null
          social_charges?: number | null
          status?: string | null
          updated_at?: string | null
          vacations_amount?: number | null
        }
        Update: {
          aguinaldo?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          gross_salary?: number
          id?: string
          net_salary?: number
          notes?: string | null
          period_id?: string | null
          salary_retention?: number | null
          social_charges?: number | null
          status?: string | null
          updated_at?: string | null
          vacations_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          language: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          language?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          language?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_parameters: {
        Row: {
          ccss_employee_rate: number | null
          ccss_employer_rate: number | null
          company_id: string | null
          created_at: string | null
          holiday_rate: number | null
          id: string
          night_rate: number | null
          overtime_rate: number | null
          saturday_multiplier: number | null
          sunday_multiplier: number | null
          updated_at: string | null
          vacation_days_per_month: number | null
          workweek: string | null
          year: number
        }
        Insert: {
          ccss_employee_rate?: number | null
          ccss_employer_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          holiday_rate?: number | null
          id?: string
          night_rate?: number | null
          overtime_rate?: number | null
          saturday_multiplier?: number | null
          sunday_multiplier?: number | null
          updated_at?: string | null
          vacation_days_per_month?: number | null
          workweek?: string | null
          year: number
        }
        Update: {
          ccss_employee_rate?: number | null
          ccss_employer_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          holiday_rate?: number | null
          id?: string
          night_rate?: number | null
          overtime_rate?: number | null
          saturday_multiplier?: number | null
          sunday_multiplier?: number | null
          updated_at?: string | null
          vacation_days_per_month?: number | null
          workweek?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          activity: string
          approved: boolean | null
          approved_by: string | null
          company_id: string | null
          cost_center: string
          created_at: string | null
          date: string
          description: string | null
          employee_id: string | null
          hours: number
          id: string
          is_holiday: boolean | null
          is_weekend: boolean | null
          project: string | null
          updated_at: string | null
        }
        Insert: {
          activity: string
          approved?: boolean | null
          approved_by?: string | null
          company_id?: string | null
          cost_center: string
          created_at?: string | null
          date: string
          description?: string | null
          employee_id?: string | null
          hours: number
          id?: string
          is_holiday?: boolean | null
          is_weekend?: boolean | null
          project?: string | null
          updated_at?: string | null
        }
        Update: {
          activity?: string
          approved?: boolean | null
          approved_by?: string | null
          company_id?: string | null
          cost_center?: string
          created_at?: string | null
          date?: string
          description?: string | null
          employee_id?: string | null
          hours?: number
          id?: string
          is_holiday?: boolean | null
          is_weekend?: boolean | null
          project?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
