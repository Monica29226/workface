import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  es: {
    // Navigation
    'nav.dashboard': 'Panel Principal',
    'nav.employees': 'Empleados',
    'nav.projects': 'Proyectos',
    'nav.contracts': 'Contratos',
    'nav.timesheets': 'Distribución Jornada',
    'nav.payroll_process': 'Proceso Planilla',
    'nav.payslips': 'Colillas',
    'nav.cost_centers': 'Centros de Costo',
    'nav.vacation_report': 'Reporte Vacaciones',
    'nav.liquidations': 'Liquidaciones',
    'nav.reports': 'Reportes',
    'nav.email_center': 'Centro Correos',
    'nav.historico': 'Histórico',
    'nav.users': 'Gestión Usuarios',
    'nav.parameters': 'Parámetros',
    'nav.create_company': 'Crear Empresa',
    'nav.admin': 'Administración',
    'nav.manager': 'Administrador',
    'nav.my_profile': 'Mi Perfil',
    'nav.my_salary_history': 'Mi Historial Salarial',
    'nav.my_vacations': 'Mis Vacaciones',
    'nav.pre_colilla': 'Pre-Colilla',
    'nav.pre_nomina': 'Pre-Nómina',

    // Dashboard
    'dashboard.title': 'Panel Principal',
    'dashboard.gross_period': 'Bruto del Período',
    'dashboard.total_deductions': 'Deducciones Totales',
    'dashboard.net_pay': 'Neto a Depositar',
    'dashboard.employer_charges': 'Cargas Patronales',
    'dashboard.active_employees': 'Empleados Activos',
    'dashboard.avg_cost_employee': 'Costo Promedio por Empleado',

    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.edit': 'Editar',
    'common.delete': 'Eliminar',
    'common.add': 'Agregar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.actions': 'Acciones',
    'common.status': 'Estado',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.loading': 'Cargando...',
    'common.recalculate': 'Recalcular',
    'common.export_excel': 'Exportar Excel',
    'common.collaborators': 'colaboradores',
    'common.select_period': 'Seleccionar período...',
    'common.view_detail': 'Ver Detalle',
    'common.download_pdf': 'Descargar Comprobante PDF',
    'common.generating': 'Generando...',
    'common.send_payslips': 'Enviar Colillas',

    // Employee fields
    'employee.cedula': 'Cédula',
    'employee.name': 'Nombre',
    'employee.email': 'Correo',
    'employee.phone': 'Teléfono',
    'employee.position': 'Puesto',
    'employee.department': 'Departamento',
    'employee.hire_date': 'Fecha Ingreso',
    'employee.salary': 'Salario',
    'employee.cost_center': 'Centro de Costo',

    // Payroll
    'payroll.gross': 'Bruto',
    'payroll.deductions': 'Deducciones',
    'payroll.net': 'Neto',
    'payroll.aguinaldo': 'Aguinaldo',
    'payroll.social_charges': 'Cargas Sociales',
    'payroll.salary_retention': 'Retención Salarial',
    'payroll.gross_salary': 'Salario Bruto',
    'payroll.total_deductions': 'Total Deducciones',
    'payroll.total_to_receive': 'Total a Recibir',
    'payroll.exchange_rate_bccr': 'Tipo de cambio BCCR',
    'payroll.deductions_breakdown': 'Desglose de Deducciones',
    'payroll.concept': 'Concepto',
    'payroll.total': 'Total',

    // Pre-Colilla
    'precolilla.title': 'Pre-Colilla',
    'precolilla.description': 'Revise y valide las colillas antes del envío',
    'precolilla.no_period_selected': 'Seleccione un período',
    'precolilla.select_period_hint': 'Elija un período de planilla para revisar las colillas',
    'precolilla.loading_data': 'Cargando datos de planilla...',
    'precolilla.no_data': 'No hay datos para este período',
    'precolilla.search_placeholder': 'Buscar colaborador por nombre o código...',
    'precolilla.no_results': 'No se encontraron colaboradores que coincidan con',
    'precolilla.detail_title': 'Detalle de Pre-Colilla',
    'precolilla.period': 'Período',
    'precolilla.no_deductions': 'No hay detalles de deducciones disponibles para este período.',

    // Deduction labels
    'deduction.ccss': 'CCSS Obrero',
    'deduction.isr': 'Impuesto sobre la Renta',
    'deduction.magisterio': 'Magisterio Nacional',
    'deduction.poliza': 'Póliza de Vida',
    'deduction.loans': 'Préstamos',

    // Status
    'status.draft': 'Borrador',
    'status.in_review': 'En Revisión',
    'status.approved': 'Aprobado',
    'status.closed': 'Cerrado',
    'status.calculated': 'Calculado',
    'status.authorized': 'Autorizado',
    'status.sent': 'Enviado',

    // Payroll types
    'payroll_type.adelanto': '1ª Quincena',
    'payroll_type.segunda': '2ª Quincena',
    'payroll_type.completa': 'Mensual',

    // Company Selector
    'companySelector.title': 'Sistema de Planillas Costa Rica',
    'companySelector.subtitle': 'Seleccione su compañía para continuar',
    'companySelector.enter': 'Ingresar'
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.employees': 'Employees',
    'nav.projects': 'Projects',
    'nav.contracts': 'Contracts',
    'nav.timesheets': 'Timesheets',
    'nav.payroll_process': 'Payroll Process',
    'nav.payslips': 'Payslips',
    'nav.cost_centers': 'Cost Centers',
    'nav.vacation_report': 'Vacation Report',
    'nav.liquidations': 'Severance',
    'nav.reports': 'Reports',
    'nav.email_center': 'Email Center',
    'nav.historico': 'Historical',
    'nav.users': 'User Management',
    'nav.parameters': 'Parameters',
    'nav.create_company': 'Create Company',
    'nav.admin': 'Administration',
    'nav.manager': 'Manager',
    'nav.my_profile': 'My Profile',
    'nav.my_salary_history': 'My Salary History',
    'nav.my_vacations': 'My Vacations',
    'nav.pre_colilla': 'Pre-Payslip',
    'nav.pre_nomina': 'Pre-Payroll',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.gross_period': 'Period Gross',
    'dashboard.total_deductions': 'Total Deductions',
    'dashboard.net_pay': 'Net to Pay',
    'dashboard.employer_charges': 'Employer Charges',
    'dashboard.active_employees': 'Active Employees',
    'dashboard.avg_cost_employee': 'Average Cost per Employee',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.loading': 'Loading...',
    'common.recalculate': 'Recalculate',
    'common.export_excel': 'Export Excel',
    'common.collaborators': 'collaborators',
    'common.select_period': 'Select period...',
    'common.view_detail': 'View Detail',
    'common.download_pdf': 'Download PDF Voucher',
    'common.generating': 'Generating...',
    'common.send_payslips': 'Send Payslips',

    // Employee fields
    'employee.cedula': 'ID',
    'employee.name': 'Name',
    'employee.email': 'Email',
    'employee.phone': 'Phone',
    'employee.position': 'Position',
    'employee.department': 'Department',
    'employee.hire_date': 'Hire Date',
    'employee.salary': 'Salary',
    'employee.cost_center': 'Cost Center',

    // Payroll
    'payroll.gross': 'Gross',
    'payroll.deductions': 'Deductions',
    'payroll.net': 'Net',
    'payroll.aguinaldo': 'Christmas Bonus',
    'payroll.social_charges': 'Social Charges',
    'payroll.salary_retention': 'Salary Retention',
    'payroll.gross_salary': 'Gross Salary',
    'payroll.total_deductions': 'Total Deductions',
    'payroll.total_to_receive': 'Total to Receive',
    'payroll.exchange_rate_bccr': 'BCCR Exchange Rate',
    'payroll.deductions_breakdown': 'Deductions Breakdown',
    'payroll.concept': 'Concept',
    'payroll.total': 'Total',

    // Pre-Colilla
    'precolilla.title': 'Pre-Payslip',
    'precolilla.description': 'Review and validate payslips before sending',
    'precolilla.no_period_selected': 'Select a period',
    'precolilla.select_period_hint': 'Choose a payroll period to review payslips',
    'precolilla.loading_data': 'Loading payroll data...',
    'precolilla.no_data': 'No data for this period',
    'precolilla.search_placeholder': 'Search collaborator by name or ID...',
    'precolilla.no_results': 'No collaborators found matching',
    'precolilla.detail_title': 'Pre-Payslip Detail',
    'precolilla.period': 'Period',
    'precolilla.no_deductions': 'No deduction details available for this period.',

    // Deduction labels
    'deduction.ccss': 'Social Security',
    'deduction.isr': 'Income Tax',
    'deduction.magisterio': 'National Teaching Fund',
    'deduction.poliza': 'Life Insurance',
    'deduction.loans': 'Loans',

    // Status
    'status.draft': 'Draft',
    'status.in_review': 'In Review',
    'status.approved': 'Approved',
    'status.closed': 'Closed',
    'status.calculated': 'Calculated',
    'status.authorized': 'Authorized',
    'status.sent': 'Sent',

    // Payroll types
    'payroll_type.adelanto': '1st Fortnight',
    'payroll_type.segunda': '2nd Fortnight',
    'payroll_type.completa': 'Monthly',

    // Company Selector
    'companySelector.title': 'Costa Rica Payroll System',
    'companySelector.subtitle': 'Select your company to continue',
    'companySelector.enter': 'Enter'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['es', 'en'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['es']] || key;
  };

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage: handleSetLanguage,
      t
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}