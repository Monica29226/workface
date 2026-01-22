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
      company_parameters: {
        Row: {
          aguinaldo_rate: number
          banco_popular_obrero: number
          banco_popular_patronal: number
          ccss_obrero_education: number
          ccss_obrero_ivm: number
          ccss_obrero_sem: number
          ccss_obrero_total: number
          ccss_patronal_ivm: number
          ccss_patronal_sem: number
          ccss_patronal_total: number
          cesantia_rate: number
          company_id: string
          created_at: string
          fodesaf_rate: number
          id: string
          imas_rate: number
          ina_rate: number
          ins_riesgos_trabajo: number
          is_education_sector: boolean
          magisterio_rate: number
          poliza_vida_fija: number
          renta_bracket_1_limit: number
          renta_bracket_1_rate: number
          renta_bracket_2_limit: number
          renta_bracket_2_rate: number
          renta_bracket_3_limit: number
          renta_bracket_3_rate: number
          renta_bracket_4_limit: number
          renta_bracket_4_rate: number
          renta_bracket_5_rate: number
          salario_minimo_referencia: number
          updated_at: string
          vacaciones_rate: number
          vacation_days_domestic: number
          vacation_days_standard: number
          vacation_domestic_monthly_accrual: number
          vacation_expiry_months: number
          vacation_monthly_accrual: number
          vacation_weeks_required: number
        }
        Insert: {
          aguinaldo_rate?: number
          banco_popular_obrero?: number
          banco_popular_patronal?: number
          ccss_obrero_education?: number
          ccss_obrero_ivm?: number
          ccss_obrero_sem?: number
          ccss_obrero_total?: number
          ccss_patronal_ivm?: number
          ccss_patronal_sem?: number
          ccss_patronal_total?: number
          cesantia_rate?: number
          company_id: string
          created_at?: string
          fodesaf_rate?: number
          id?: string
          imas_rate?: number
          ina_rate?: number
          ins_riesgos_trabajo?: number
          is_education_sector?: boolean
          magisterio_rate?: number
          poliza_vida_fija?: number
          renta_bracket_1_limit?: number
          renta_bracket_1_rate?: number
          renta_bracket_2_limit?: number
          renta_bracket_2_rate?: number
          renta_bracket_3_limit?: number
          renta_bracket_3_rate?: number
          renta_bracket_4_limit?: number
          renta_bracket_4_rate?: number
          renta_bracket_5_rate?: number
          salario_minimo_referencia?: number
          updated_at?: string
          vacaciones_rate?: number
          vacation_days_domestic?: number
          vacation_days_standard?: number
          vacation_domestic_monthly_accrual?: number
          vacation_expiry_months?: number
          vacation_monthly_accrual?: number
          vacation_weeks_required?: number
        }
        Update: {
          aguinaldo_rate?: number
          banco_popular_obrero?: number
          banco_popular_patronal?: number
          ccss_obrero_education?: number
          ccss_obrero_ivm?: number
          ccss_obrero_sem?: number
          ccss_obrero_total?: number
          ccss_patronal_ivm?: number
          ccss_patronal_sem?: number
          ccss_patronal_total?: number
          cesantia_rate?: number
          company_id?: string
          created_at?: string
          fodesaf_rate?: number
          id?: string
          imas_rate?: number
          ina_rate?: number
          ins_riesgos_trabajo?: number
          is_education_sector?: boolean
          magisterio_rate?: number
          poliza_vida_fija?: number
          renta_bracket_1_limit?: number
          renta_bracket_1_rate?: number
          renta_bracket_2_limit?: number
          renta_bracket_2_rate?: number
          renta_bracket_3_limit?: number
          renta_bracket_3_rate?: number
          renta_bracket_4_limit?: number
          renta_bracket_4_rate?: number
          renta_bracket_5_rate?: number
          salario_minimo_referencia?: number
          updated_at?: string
          vacaciones_rate?: number
          vacation_days_domestic?: number
          vacation_days_standard?: number
          vacation_domestic_monthly_accrual?: number
          vacation_expiry_months?: number
          vacation_monthly_accrual?: number
          vacation_weeks_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      cost_centers: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      email_logs: {
        Row: {
          attachment_url: string | null
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          company_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          id: string
          language: string
          name: string
          subject: string
          type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          id?: string
          language?: string
          name: string
          subject: string
          type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          id?: string
          language?: string
          name?: string
          subject?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          loan_type: string
          monthly_deduction: number
          notes: string | null
          original_amount: number
          remaining_balance: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          loan_type?: string
          monthly_deduction?: number
          notes?: string | null
          original_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          loan_type?: string
          monthly_deduction?: number
          notes?: string | null
          original_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacations: {
        Row: {
          accrual_start_date: string | null
          company_id: string
          created_at: string
          daily_rate: number | null
          days_accrued: number
          days_pending: number | null
          days_taken: number
          employee_id: string
          expiry_date: string | null
          id: string
          notes: string | null
          pending_amount: number | null
          updated_at: string
          year: number
        }
        Insert: {
          accrual_start_date?: string | null
          company_id: string
          created_at?: string
          daily_rate?: number | null
          days_accrued?: number
          days_pending?: number | null
          days_taken?: number
          employee_id: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          accrual_start_date?: string | null
          company_id?: string
          created_at?: string
          daily_rate?: number | null
          days_accrued?: number
          days_pending?: number | null
          days_taken?: number
          employee_id?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          cost_center_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          employee_id: string
          full_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          loan_amount: number | null
          loan_monthly_deduction: number | null
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
          cost_center_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          employee_id: string
          full_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          loan_amount?: number | null
          loan_monthly_deduction?: number | null
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
          cost_center_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          employee_id?: string
          full_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          loan_amount?: number | null
          loan_monthly_deduction?: number | null
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
            foreignKeyName: "employees_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
          payroll_type: Database["public"]["Enums"]["payroll_type"] | null
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
          payroll_type?: Database["public"]["Enums"]["payroll_type"] | null
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
          payroll_type?: Database["public"]["Enums"]["payroll_type"] | null
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
      payroll_line_changes: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          payroll_line_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          payroll_line_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          payroll_line_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_changes_payroll_line_id_fkey"
            columns: ["payroll_line_id"]
            isOneToOne: false
            referencedRelation: "payroll_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          absence_days: number | null
          additional_bonuses: number | null
          additional_deductions: number | null
          aguinaldo_accrued: number | null
          batch_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          deductions: number | null
          deductions_detail: Json | null
          employee_id: string
          employer_contrib: number | null
          exchange_rate_to_base: number | null
          gross_salary: number
          id: string
          line_id: string
          manual_adjustments: Json | null
          net_pay: number
          notes: string | null
          overtime: number | null
          overtime_hours: number | null
          project_hours_amount: number | null
          regular_hours: number | null
          sick_leave_days: number | null
          total_to_pay: number | null
          updated_at: string
          vacation_accrued_days: number | null
          vacation_days_taken: number | null
        }
        Insert: {
          absence_days?: number | null
          additional_bonuses?: number | null
          additional_deductions?: number | null
          aguinaldo_accrued?: number | null
          batch_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          deductions?: number | null
          deductions_detail?: Json | null
          employee_id: string
          employer_contrib?: number | null
          exchange_rate_to_base?: number | null
          gross_salary: number
          id?: string
          line_id: string
          manual_adjustments?: Json | null
          net_pay: number
          notes?: string | null
          overtime?: number | null
          overtime_hours?: number | null
          project_hours_amount?: number | null
          regular_hours?: number | null
          sick_leave_days?: number | null
          total_to_pay?: number | null
          updated_at?: string
          vacation_accrued_days?: number | null
          vacation_days_taken?: number | null
        }
        Update: {
          absence_days?: number | null
          additional_bonuses?: number | null
          additional_deductions?: number | null
          aguinaldo_accrued?: number | null
          batch_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          deductions?: number | null
          deductions_detail?: Json | null
          employee_id?: string
          employer_contrib?: number | null
          exchange_rate_to_base?: number | null
          gross_salary?: number
          id?: string
          line_id?: string
          manual_adjustments?: Json | null
          net_pay?: number
          notes?: string | null
          overtime?: number | null
          overtime_hours?: number | null
          project_hours_amount?: number | null
          regular_hours?: number | null
          sick_leave_days?: number | null
          total_to_pay?: number | null
          updated_at?: string
          vacation_accrued_days?: number | null
          vacation_days_taken?: number | null
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
            foreignKeyName: "payroll_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_safe_view"
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
      payslip_settings: {
        Row: {
          company_id: string
          created_at: string
          document_title: string
          employee_label: string
          footer_text: string | null
          id: string
          net_pay_label: string
          show_absence_days: boolean
          show_accruals_section: boolean
          show_aguinaldo_accrued: boolean
          show_bonuses: boolean
          show_company_logo: boolean
          show_cost_center: boolean
          show_deductions_section: boolean
          show_earnings_section: boolean
          show_hire_date: boolean
          show_hours_section: boolean
          show_loans: boolean
          show_overtime_hours: boolean
          show_platform_branding: boolean
          show_usd_banner: boolean
          show_vacation_accrued: boolean
          show_vacation_days: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_title?: string
          employee_label?: string
          footer_text?: string | null
          id?: string
          net_pay_label?: string
          show_absence_days?: boolean
          show_accruals_section?: boolean
          show_aguinaldo_accrued?: boolean
          show_bonuses?: boolean
          show_company_logo?: boolean
          show_cost_center?: boolean
          show_deductions_section?: boolean
          show_earnings_section?: boolean
          show_hire_date?: boolean
          show_hours_section?: boolean
          show_loans?: boolean
          show_overtime_hours?: boolean
          show_platform_branding?: boolean
          show_usd_banner?: boolean
          show_vacation_accrued?: boolean
          show_vacation_days?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_title?: string
          employee_label?: string
          footer_text?: string | null
          id?: string
          net_pay_label?: string
          show_absence_days?: boolean
          show_accruals_section?: boolean
          show_aguinaldo_accrued?: boolean
          show_bonuses?: boolean
          show_company_logo?: boolean
          show_cost_center?: boolean
          show_deductions_section?: boolean
          show_earnings_section?: boolean
          show_hire_date?: boolean
          show_hours_section?: boolean
          show_loans?: boolean
          show_overtime_hours?: boolean
          show_platform_branding?: boolean
          show_usd_banner?: boolean
          show_vacation_accrued?: boolean
          show_vacation_days?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
            referencedRelation: "employee_safe_view"
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
            referencedRelation: "employee_safe_view"
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
      user_company_permissions: {
        Row: {
          can_manage_employees: boolean | null
          can_manage_parameters: boolean | null
          can_manage_payroll: boolean | null
          can_manage_projects: boolean | null
          can_view_reports: boolean | null
          company_id: string
          created_at: string | null
          id: string
          permission_level: string
          project_ids: string[] | null
          project_scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_manage_employees?: boolean | null
          can_manage_parameters?: boolean | null
          can_manage_payroll?: boolean | null
          can_manage_projects?: boolean | null
          can_view_reports?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          permission_level: string
          project_ids?: string[] | null
          project_scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_manage_employees?: boolean | null
          can_manage_parameters?: boolean | null
          can_manage_payroll?: boolean | null
          can_manage_projects?: boolean | null
          can_view_reports?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          permission_level?: string
          project_ids?: string[] | null
          project_scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      vacation_requests: {
        Row: {
          company_id: string
          created_at: string
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_safe_view: {
        Row: {
          aguinaldo_base_12m: number | null
          base_salary: number | null
          company_id: string | null
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          cost_center_id: string | null
          created_at: string | null
          currency: Database["public"]["Enums"]["currency_type"] | null
          employee_id: string | null
          full_name: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          updated_at: string | null
          user_id: string | null
          vac_balance_days: number | null
          work_email: string | null
        }
        Insert: {
          aguinaldo_base_12m?: number | null
          base_salary?: never
          company_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          cost_center_id?: string | null
          created_at?: string | null
          currency?: Database["public"]["Enums"]["currency_type"] | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          updated_at?: string | null
          user_id?: string | null
          vac_balance_days?: number | null
          work_email?: string | null
        }
        Update: {
          aguinaldo_base_12m?: number | null
          base_salary?: never
          company_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          cost_center_id?: string | null
          created_at?: string | null
          currency?: Database["public"]["Enums"]["currency_type"] | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: never
          id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          updated_at?: string | null
          user_id?: string | null
          vac_balance_days?: number | null
          work_email?: string | null
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
            foreignKeyName: "employees_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
    }
    Functions: {
      can_access_salary_data: { Args: { _user_id: string }; Returns: boolean }
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
      app_role:
        | "admin"
        | "company_manager"
        | "employee"
        | "ACL_SuperAdmin"
        | "ACL_PayrollSpecialist"
        | "ACL_Auditor"
        | "Client_Admin"
        | "Client_HR"
        | "Client_Viewer"
        | "Employee_Portal"
      contract_type: "mensual" | "por_horas"
      currency_type: "CRC" | "USD" | "EUR" | "GBP"
      employee_status: "activo" | "inactivo"
      payroll_batch_status:
        | "borrador"
        | "calculado"
        | "aprobado"
        | "autorizado"
        | "enviado"
      payroll_frequency: "semanal" | "quincenal" | "mensual"
      payroll_type: "adelanto" | "segunda" | "completa"
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
      app_role: [
        "admin",
        "company_manager",
        "employee",
        "ACL_SuperAdmin",
        "ACL_PayrollSpecialist",
        "ACL_Auditor",
        "Client_Admin",
        "Client_HR",
        "Client_Viewer",
        "Employee_Portal",
      ],
      contract_type: ["mensual", "por_horas"],
      currency_type: ["CRC", "USD", "EUR", "GBP"],
      employee_status: ["activo", "inactivo"],
      payroll_batch_status: [
        "borrador",
        "calculado",
        "aprobado",
        "autorizado",
        "enviado",
      ],
      payroll_frequency: ["semanal", "quincenal", "mensual"],
      payroll_type: ["adelanto", "segunda", "completa"],
      project_status: ["activo", "cerrado"],
    },
  },
} as const
