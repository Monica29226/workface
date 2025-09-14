import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Calculator, 
  FileText, 
  Download, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Mail,
  Edit,
  Save,
  ArrowLeft,
  ArrowRight,
  X,
  Info,
  History,
  Building2,
  User,
  Calendar,
  DollarSign,
  HelpCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Types and interfaces
interface Employee {
  id: string;
  name: string;
  cedula: string;
  email: string;
  position: string;
  department: string;
  costCenter: string;
  hireDate: string;
  monthlySalary: number;
  contractType: string;
  isActive: boolean;
}

interface LegalParameters {
  vacationDaysPerMonth: number;
  aguinaldoPeriod: { start: string; end: string };
  severanceMatrix: Array<{ years: number; days: number }>;
  maxSeverance: number; // in monthly salaries
  ccssEmployee: number;
  ccssEmployer: number;
  rentaTramps: Array<{ from: number; to: number; rate: number }>;
  deductions: { spouse: number; child: number };
  overtimeRate: number;
  holidayRate: number;
  nightRate: number;
  weekendRates: { saturday: number; sunday: number };
}

interface LiquidationStep1 {
  employeeId: string;
  employee?: Employee;
  companyId: string;
  costCenter: string;
  project: string;
  hireDate: string;
  terminationDate: string;
  cause: 'con_responsabilidad' | 'sin_responsabilidad' | 'renuncia' | 'mutuo_acuerdo';
  preavisoType: 'otorgado' | 'trabajado' | 'pagado' | 'no_aplica';
  preaviso: { days: number; worked: boolean; paid: boolean };
  observations: string;
}

interface LiquidationStep2 {
  vacaciones: { days: number; amount: number; override: boolean; reason: string };
  aguinaldo: { basePeriod: string; amount: number; override: boolean; reason: string };
  preaviso: { days: number; amount: number; override: boolean; reason: string };
  cesantia: { days: number; amount: number; maxApplied: boolean; override: boolean; reason: string };
  pendientes: Array<{ concept: string; amount: number; source: 'timesheet' | 'manual' }>;
  otrosIngresos: Array<{ concept: string; amount: number }>;
}

interface LiquidationStep3 {
  ccssEmployee: { base: number; rate: number; amount: number };
  impuestoRenta: { base: number; amount: number; deductions: number };
  embargos: Array<{ concept: string; amount: number }>;
  prestamos: Array<{ concept: string; amount: number }>;
  adelantos: Array<{ concept: string; amount: number }>;
  otrasDeducciones: Array<{ concept: string; amount: number }>;
}

interface LiquidationStep4 {
  totalIngresos: number;
  totalDeducciones: number;
  totalPagar: number;
  ajusteFinal: { amount: number; reason: string };
}

interface Liquidation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  companyId: string;
  terminationDate: string;
  cause: string;
  step1: LiquidationStep1;
  step2: LiquidationStep2;
  step3: LiquidationStep3;
  step4: LiquidationStep4;
  status: 'draft' | 'calculated' | 'approved' | 'closed';
  createdDate: string;
  createdBy: string;
  approvedDate?: string;
  approvedBy?: string;
  pdfUrls: { carta?: string; recibo?: string };
  auditLog: Array<{ timestamp: string; user: string; change: string }>;
}

export function Liquidaciones() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  
  // Main state
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingLiquidation, setEditingLiquidation] = useState<string | null>(null);
  
  // Wizard state
  const [step1Data, setStep1Data] = useState<LiquidationStep1>({
    employeeId: '',
    companyId: selectedCompany?.id || '',
    costCenter: '',
    project: '',
    hireDate: '',
    terminationDate: new Date().toISOString().split('T')[0],
    cause: 'renuncia',
    preavisoType: 'no_aplica',
    preaviso: { days: 0, worked: false, paid: false },
    observations: ''
  });
  
  const [step2Data, setStep2Data] = useState<LiquidationStep2>({
    vacaciones: { days: 0, amount: 0, override: false, reason: '' },
    aguinaldo: { basePeriod: '', amount: 0, override: false, reason: '' },
    preaviso: { days: 0, amount: 0, override: false, reason: '' },
    cesantia: { days: 0, amount: 0, maxApplied: false, override: false, reason: '' },
    pendientes: [],
    otrosIngresos: []
  });
  
  const [step3Data, setStep3Data] = useState<LiquidationStep3>({
    ccssEmployee: { base: 0, rate: 0.105, amount: 0 },
    impuestoRenta: { base: 0, amount: 0, deductions: 0 },
    embargos: [],
    prestamos: [],
    adelantos: [],
    otrasDeducciones: []
  });
  
  const [step4Data, setStep4Data] = useState<LiquidationStep4>({
    totalIngresos: 0,
    totalDeducciones: 0,
    totalPagar: 0,
    ajusteFinal: { amount: 0, reason: '' }
  });

  // Sample data
  const employees: Employee[] = [
    {
      id: 'emp1',
      name: 'Gabriel Cordero González',
      cedula: '1-1354-0838',
      email: 'gabriel.cordero@horizontepositivo.org',
      position: 'Director Ejecutivo',
      department: 'Administración',
      costCenter: 'Administración',
      hireDate: '2020-01-15',
      monthlySalary: 2424480,
      contractType: 'indefinido',
      isActive: true
    },
    {
      id: 'emp2',
      name: 'Krissya Paulina Gutiérrez Solís',
      cedula: '1-1936-0602',
      email: 'krissya.gutierrez@horizontepositivo.org',
      position: 'Soporte Interno',
      department: 'Programas',
      costCenter: 'Programas',
      hireDate: '2021-03-01',
      monthlySalary: 606120,
      contractType: 'indefinido',
      isActive: true
    }
  ];

  const legalParameters: LegalParameters = {
    vacationDaysPerMonth: 1.25,
    aguinaldoPeriod: { start: '12-01', end: '11-30' },
    severanceMatrix: [
      { years: 1, days: 19.5 },
      { years: 2, days: 20 },
      { years: 3, days: 20.5 },
      { years: 4, days: 21 },
      { years: 5, days: 21.24 }
    ],
    maxSeverance: 8,
    ccssEmployee: 0.105,
    ccssEmployer: 0.26,
    rentaTramps: [
      { from: 0, to: 941000, rate: 0 },
      { from: 941001, to: 1381000, rate: 0.10 },
      { from: 1381001, to: 2423000, rate: 0.15 },
      { from: 2423001, to: 4845000, rate: 0.20 },
      { from: 4845001, to: Infinity, rate: 0.25 }
    ],
    deductions: { spouse: 25000, child: 25000 },
    overtimeRate: 1.5,
    holidayRate: 2.0,
    nightRate: 1.25,
    weekendRates: { saturday: 1.0, sunday: 1.5 }
  };

  // Sample liquidations data
  useEffect(() => {
    setLiquidations([
      {
        id: '1',
        employeeId: 'emp1',
        employeeName: 'Gabriel Cordero González',
        employeeCedula: '1-1354-0838',
        companyId: selectedCompany?.id || '',
        terminationDate: '2025-09-15',
        cause: 'Renuncia voluntaria',
        step1: step1Data,
        step2: step2Data,
        step3: step3Data,
        step4: {
          totalIngresos: 1270000,
          totalDeducciones: 45000,
          totalPagar: 1225000,
          ajusteFinal: { amount: 0, reason: '' }
        },
        status: 'calculated',
        createdDate: '2025-09-10',
        createdBy: 'admin',
        pdfUrls: {},
        auditLog: [
          { timestamp: '2025-09-10T10:00:00Z', user: 'admin', change: 'Liquidación creada' }
        ]
      }
    ]);
  }, [selectedCompany]);

  // Calculation functions
  const calculateYearsWorked = (hireDate: string, terminationDate: string): number => {
    const start = new Date(hireDate);
    const end = new Date(terminationDate);
    return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  };

  const calculateVacationDays = (hireDate: string, terminationDate: string): number => {
    const yearsWorked = calculateYearsWorked(hireDate, terminationDate);
    return yearsWorked * 12 * legalParameters.vacationDaysPerMonth;
  };

  const calculateSeverance = (yearsWorked: number, monthlySalary: number): { days: number; amount: number; maxApplied: boolean } => {
    let days = 0;
    
    const matrix = legalParameters.severanceMatrix;
    for (let i = 0; i < matrix.length; i++) {
      if (yearsWorked >= matrix[i].years && (i === matrix.length - 1 || yearsWorked < matrix[i + 1].years)) {
        days = matrix[i].days;
        break;
      }
    }

    const dailySalary = monthlySalary / 30;
    const calculatedAmount = days * dailySalary;
    const maxAmount = legalParameters.maxSeverance * monthlySalary;
    const maxApplied = calculatedAmount > maxAmount;
    
    return {
      days,
      amount: Math.min(calculatedAmount, maxAmount),
      maxApplied
    };
  };

  const calculateAguinaldo = (monthlySalary: number, hireDate: string, terminationDate: string): number => {
    // Simplified aguinaldo calculation - in real implementation would consider actual period
    const yearsWorked = calculateYearsWorked(hireDate, terminationDate);
    const monthsInCurrentPeriod = Math.min(yearsWorked * 12, 12);
    return (monthlySalary * monthsInCurrentPeriod) / 12;
  };

  const calculateIncomeTax = (grossAmount: number): { base: number; amount: number } => {
    let tax = 0;
    let remainingAmount = grossAmount;
    
    for (const tramp of legalParameters.rentaTramps) {
      if (remainingAmount <= 0) break;
      
      const taxableInThisTramp = Math.min(remainingAmount, tramp.to - tramp.from);
      tax += taxableInThisTramp * tramp.rate;
      remainingAmount -= taxableInThisTramp;
    }
    
    return { base: grossAmount, amount: tax };
  };

  // Auto-calculate when employee or dates change
  useEffect(() => {
    if (step1Data.employeeId && step1Data.hireDate && step1Data.terminationDate) {
      const employee = employees.find(e => e.id === step1Data.employeeId);
      if (employee) {
        const yearsWorked = calculateYearsWorked(step1Data.hireDate, step1Data.terminationDate);
        const vacationDays = calculateVacationDays(step1Data.hireDate, step1Data.terminationDate);
        const severance = calculateSeverance(yearsWorked, employee.monthlySalary);
        const aguinaldo = calculateAguinaldo(employee.monthlySalary, step1Data.hireDate, step1Data.terminationDate);
        const dailySalary = employee.monthlySalary / 30;

        setStep2Data(prev => ({
          ...prev,
          vacaciones: prev.vacaciones.override ? prev.vacaciones : {
            ...prev.vacaciones,
            days: Math.round(vacationDays * 100) / 100,
            amount: Math.round(vacationDays * dailySalary)
          },
          aguinaldo: prev.aguinaldo.override ? prev.aguinaldo : {
            ...prev.aguinaldo,
            amount: Math.round(aguinaldo)
          },
          cesantia: prev.cesantia.override ? prev.cesantia : {
            ...prev.cesantia,
            days: severance.days,
            amount: Math.round(severance.amount),
            maxApplied: severance.maxApplied
          }
        }));

        // Calculate CCSS and income tax in step 3
        const totalIngresos = Math.round(vacationDays * dailySalary) + Math.round(aguinaldo) + Math.round(severance.amount);
        const ccssAmount = Math.round(totalIngresos * legalParameters.ccssEmployee);
        const incomeTax = calculateIncomeTax(totalIngresos);

        setStep3Data(prev => ({
          ...prev,
          ccssEmployee: {
            ...prev.ccssEmployee,
            base: totalIngresos,
            amount: ccssAmount
          },
          impuestoRenta: {
            ...prev.impuestoRenta,
            base: incomeTax.base,
            amount: Math.round(incomeTax.amount)
          }
        }));
      }
    }
  }, [step1Data.employeeId, step1Data.hireDate, step1Data.terminationDate]);

  // Update totals in step 4
  useEffect(() => {
    const totalIngresos = step2Data.vacaciones.amount + 
                         step2Data.aguinaldo.amount + 
                         step2Data.preaviso.amount + 
                         step2Data.cesantia.amount +
                         step2Data.pendientes.reduce((sum, item) => sum + item.amount, 0) +
                         step2Data.otrosIngresos.reduce((sum, item) => sum + item.amount, 0);

    const totalDeducciones = step3Data.ccssEmployee.amount +
                            step3Data.impuestoRenta.amount +
                            step3Data.embargos.reduce((sum, item) => sum + item.amount, 0) +
                            step3Data.prestamos.reduce((sum, item) => sum + item.amount, 0) +
                            step3Data.adelantos.reduce((sum, item) => sum + item.amount, 0) +
                            step3Data.otrasDeducciones.reduce((sum, item) => sum + item.amount, 0);

    setStep4Data(prev => ({
      ...prev,
      totalIngresos,
      totalDeducciones,
      totalPagar: totalIngresos - totalDeducciones + prev.ajusteFinal.amount
    }));
  }, [step2Data, step3Data]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Borrador</Badge>;
      case 'calculated':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Calculada</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprobada</Badge>;
      case 'closed':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Cerrada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCauseLabel = (cause: string) => {
    const causes = {
      'con_responsabilidad': 'Con responsabilidad patronal',
      'sin_responsabilidad': 'Sin responsabilidad patronal',
      'renuncia': 'Renuncia voluntaria',
      'mutuo_acuerdo': 'Mutuo acuerdo'
    };
    return causes[cause as keyof typeof causes] || cause;
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = () => {
    toast({
      title: "Borrador guardado",
      description: "La liquidación ha sido guardada como borrador.",
    });
  };

  const handleCalculate = () => {
    toast({
      title: "Liquidación calculada",
      description: "Los cálculos han sido actualizados correctamente.",
    });
  };

  const handleApprove = () => {
    toast({
      title: "Liquidación aprobada",
      description: "La liquidación ha sido aprobada y no puede ser modificada.",
    });
  };

  const handleGeneratePDF = () => {
    // Generate liquidation letter and receipt PDFs
    const employee = employees.find(e => e.id === step1Data.employeeId);
    if (!employee) return;

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Carta de Liquidación - ${employee.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0B2B4C; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; color: #0B2B4C; }
            .company-logo { color: #2A9D8F; font-size: 20px; margin-bottom: 10px; }
            .title { font-size: 18px; margin: 20px 0; color: #2A9D8F; text-align: center; }
            .employee-info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #2A9D8F; }
            .section { margin: 20px 0; }
            .section-title { background: #2A9D8F; color: white; padding: 8px; font-weight: bold; }
            .calculation-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .calculation-table th, .calculation-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .calculation-table th { background: #f8f9fa; font-weight: bold; }
            .amount { text-align: right; font-family: monospace; }
            .total-row { background: #e9ecef; font-weight: bold; }
            .signature-section { margin-top: 50px; }
            .signature-box { border: 1px solid #ccc; height: 80px; margin: 20px 0; position: relative; }
            .signature-label { position: absolute; bottom: 5px; left: 10px; font-size: 12px; color: #666; }
            .footer { margin-top: 40px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-logo">Horizonte +</div>
            <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
            <div>Cédula Jurídica: ${selectedCompany?.juridical_id || 'N/A'}</div>
          </div>

          <div class="title">CARTA DE LIQUIDACIÓN LABORAL</div>

          <div class="employee-info">
            <h3>DATOS DEL COLABORADOR</h3>
            <p><strong>Nombre:</strong> ${employee.name}</p>
            <p><strong>Cédula:</strong> ${employee.cedula}</p>
            <p><strong>Puesto:</strong> ${employee.position}</p>
            <p><strong>Fecha de Ingreso:</strong> ${formatDate(step1Data.hireDate)}</p>
            <p><strong>Fecha de Corte:</strong> ${formatDate(step1Data.terminationDate)}</p>
            <p><strong>Causal:</strong> ${getCauseLabel(step1Data.cause)}</p>
            <p><strong>Salario Mensual:</strong> ${formatCurrency(employee.monthlySalary, 'CRC')}</p>
          </div>

          <div class="section">
            <div class="section-title">DETALLE DE LIQUIDACIÓN</div>
            <table class="calculation-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Días/Base</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vacaciones no disfrutadas</td>
                  <td class="amount">${step2Data.vacaciones.days.toFixed(2)} días</td>
                  <td class="amount">${formatCurrency(step2Data.vacaciones.amount, 'CRC')}</td>
                </tr>
                <tr>
                  <td>Aguinaldo proporcional</td>
                  <td class="amount">Proporcional</td>
                  <td class="amount">${formatCurrency(step2Data.aguinaldo.amount, 'CRC')}</td>
                </tr>
                ${step2Data.preaviso.amount > 0 ? `
                <tr>
                  <td>Preaviso</td>
                  <td class="amount">${step2Data.preaviso.days} días</td>
                  <td class="amount">${formatCurrency(step2Data.preaviso.amount, 'CRC')}</td>
                </tr>` : ''}
                ${step2Data.cesantia.amount > 0 ? `
                <tr>
                  <td>Cesantía</td>
                  <td class="amount">${step2Data.cesantia.days} días</td>
                  <td class="amount">${formatCurrency(step2Data.cesantia.amount, 'CRC')}</td>
                </tr>` : ''}
                <tr class="total-row">
                  <td colspan="2"><strong>TOTAL INGRESOS</strong></td>
                  <td class="amount"><strong>${formatCurrency(step4Data.totalIngresos, 'CRC')}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">DEDUCCIONES</div>
            <table class="calculation-table">
              <tbody>
                <tr>
                  <td>CCSS Trabajador (${(legalParameters.ccssEmployee * 100).toFixed(1)}%)</td>
                  <td class="amount">${formatCurrency(step3Data.ccssEmployee.amount, 'CRC')}</td>
                </tr>
                <tr>
                  <td>Impuesto sobre la Renta</td>
                  <td class="amount">${formatCurrency(step3Data.impuestoRenta.amount, 'CRC')}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>TOTAL DEDUCCIONES</strong></td>
                  <td class="amount"><strong>${formatCurrency(step4Data.totalDeducciones, 'CRC')}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section" style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 18px; font-weight: bold; border: 2px solid #2A9D8F;">
            TOTAL A PAGAR: ${formatCurrency(step4Data.totalPagar, 'CRC')}
          </div>

          <div class="signature-section">
            <p>En conformidad con lo anterior, las partes firman la presente liquidación:</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px;">
              <div>
                <div class="signature-box">
                  <div class="signature-label">Firma del Colaborador</div>
                </div>
                <p style="text-align: center; margin-top: 10px;">${employee.name}</p>
                <p style="text-align: center;">Cédula: ${employee.cedula}</p>
              </div>
              
              <div>
                <div class="signature-box">
                  <div class="signature-label">Representante de la Empresa</div>
                </div>
                <p style="text-align: center; margin-top: 10px;">${selectedCompany?.name}</p>
                <p style="text-align: center;">Cédula Jurídica: ${selectedCompany?.juridical_id}</p>
              </div>
            </div>

            <p style="text-align: center; margin-top: 30px;">
              Fecha: ______________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Lugar: ______________________
            </p>
          </div>

          <div class="footer">
            <p><strong>Nota Legal:</strong> Esta liquidación se calcula con base en la legislación laboral costarricense vigente.</p>
            <p>Los cálculos son referenciales y deben ser validados por un profesional en derecho laboral.</p>
            <p>Generado el ${formatDate(new Date().toISOString())} por ${selectedCompany?.name}</p>
          </div>
        </body>
        </html>
      `);
      pdfWindow.document.close();
    }
  };

  const handleSendEmail = () => {
    toast({
      title: "Correo enviado",
      description: "La liquidación ha sido enviada por correo electrónico.",
    });
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setStep1Data({
      employeeId: '',
      companyId: selectedCompany?.id || '',
      costCenter: '',
      project: '',
      hireDate: '',
      terminationDate: new Date().toISOString().split('T')[0],
      cause: 'renuncia',
      preavisoType: 'no_aplica',
      preaviso: { days: 0, worked: false, paid: false },
      observations: ''
    });
    setStep2Data({
      vacaciones: { days: 0, amount: 0, override: false, reason: '' },
      aguinaldo: { basePeriod: '', amount: 0, override: false, reason: '' },
      preaviso: { days: 0, amount: 0, override: false, reason: '' },
      cesantia: { days: 0, amount: 0, maxApplied: false, override: false, reason: '' },
      pendientes: [],
      otrosIngresos: []
    });
    setStep3Data({
      ccssEmployee: { base: 0, rate: 0.105, amount: 0 },
      impuestoRenta: { base: 0, amount: 0, deductions: 0 },
      embargos: [],
      prestamos: [],
      adelantos: [],
      otrasDeducciones: []
    });
    setStep4Data({
      totalIngresos: 0,
      totalDeducciones: 0,
      totalPagar: 0,
      ajusteFinal: { amount: 0, reason: '' }
    });
  };

  // Render wizard steps
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          1
        </div>
        <h3 className="text-lg font-semibold">Datos del Caso</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Empleado *</Label>
            <Select 
              value={step1Data.employeeId} 
              onValueChange={(value) => {
                const employee = employees.find(e => e.id === value);
                setStep1Data(prev => ({ 
                  ...prev, 
                  employeeId: value,
                  employee,
                  hireDate: employee?.hireDate || '',
                  costCenter: employee?.costCenter || ''
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empleado..." />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.isActive).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} - {employee.cedula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terminationDate">Fecha de Corte *</Label>
            <Input
              id="terminationDate"
              type="date"
              value={step1Data.terminationDate}
              onChange={(e) => setStep1Data(prev => ({ ...prev, terminationDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cause">Causal de Terminación *</Label>
            <Select 
              value={step1Data.cause} 
              onValueChange={(value) => setStep1Data(prev => ({ ...prev, cause: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="con_responsabilidad">Con responsabilidad patronal</SelectItem>
                <SelectItem value="sin_responsabilidad">Sin responsabilidad patronal</SelectItem>
                <SelectItem value="renuncia">Renuncia voluntaria</SelectItem>
                <SelectItem value="mutuo_acuerdo">Mutuo acuerdo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preavisoType">Tipo de Preaviso</Label>
            <Select 
              value={step1Data.preavisoType} 
              onValueChange={(value) => setStep1Data(prev => ({ ...prev, preavisoType: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="otorgado">Otorgado</SelectItem>
                <SelectItem value="trabajado">Trabajado</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="no_aplica">No aplica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones</Label>
            <Textarea
              id="observations"
              placeholder="Observaciones del caso..."
              value={step1Data.observations}
              onChange={(e) => setStep1Data(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          {step1Data.employee && (
            <Card className="p-4 bg-muted/25">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Información del Empleado
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Nombre:</span>
                  <span className="font-medium">{step1Data.employee.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cédula:</span>
                  <span className="font-medium">{step1Data.employee.cedula}</span>
                </div>
                <div className="flex justify-between">
                  <span>Puesto:</span>
                  <span className="font-medium">{step1Data.employee.position}</span>
                </div>
                <div className="flex justify-between">
                  <span>Departamento:</span>
                  <span className="font-medium">{step1Data.employee.department}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha Ingreso:</span>
                  <span className="font-medium">{formatDate(step1Data.employee.hireDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Salario Mensual:</span>
                  <span className="font-medium">{formatCurrency(step1Data.employee.monthlySalary, 'CRC')}</span>
                </div>
                {step1Data.terminationDate && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span>Antigüedad:</span>
                      <span className="font-medium">
                        {calculateYearsWorked(step1Data.employee.hireDate, step1Data.terminationDate).toFixed(2)} años
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salario Diario:</span>
                      <span className="font-medium">
                        {formatCurrency(step1Data.employee.monthlySalary / 30, 'CRC')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          2
        </div>
        <h3 className="text-lg font-semibold">Ingresos por Liquidación</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vacaciones */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vacaciones no Disfrutadas
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Días</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={step2Data.vacaciones.days}
                  onChange={(e) => {
                    const days = parseFloat(e.target.value) || 0;
                    const dailySalary = step1Data.employee ? step1Data.employee.monthlySalary / 30 : 0;
                    setStep2Data(prev => ({
                      ...prev,
                      vacaciones: {
                        ...prev.vacaciones,
                        days,
                        amount: Math.round(days * dailySalary),
                        override: true
                      }
                    }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={step2Data.vacaciones.amount}
                  onChange={(e) => {
                    setStep2Data(prev => ({
                      ...prev,
                      vacaciones: {
                        ...prev.vacaciones,
                        amount: parseInt(e.target.value) || 0,
                        override: true
                      }
                    }));
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Base: {legalParameters.vacationDaysPerMonth} días por mes trabajado
            </div>
          </div>
        </Card>

        {/* Aguinaldo */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Aguinaldo Proporcional
          </h4>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                value={step2Data.aguinaldo.amount}
                onChange={(e) => {
                  setStep2Data(prev => ({
                    ...prev,
                    aguinaldo: {
                      ...prev.aguinaldo,
                      amount: parseInt(e.target.value) || 0,
                      override: true
                    }
                  }));
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Período: {legalParameters.aguinaldoPeriod.start} al {legalParameters.aguinaldoPeriod.end}
            </div>
          </div>
        </Card>

        {/* Preaviso */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Preaviso</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Días</Label>
                <Input
                  type="number"
                  value={step2Data.preaviso.days}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 0;
                    const dailySalary = step1Data.employee ? step1Data.employee.monthlySalary / 30 : 0;
                    setStep2Data(prev => ({
                      ...prev,
                      preaviso: {
                        ...prev.preaviso,
                        days,
                        amount: Math.round(days * dailySalary),
                        override: true
                      }
                    }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={step2Data.preaviso.amount}
                  onChange={(e) => {
                    setStep2Data(prev => ({
                      ...prev,
                      preaviso: {
                        ...prev.preaviso,
                        amount: parseInt(e.target.value) || 0,
                        override: true
                      }
                    }));
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Según causal: {getCauseLabel(step1Data.cause)}
            </div>
          </div>
        </Card>

        {/* Cesantía */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Cesantía</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Días</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={step2Data.cesantia.days}
                  onChange={(e) => {
                    const days = parseFloat(e.target.value) || 0;
                    const dailySalary = step1Data.employee ? step1Data.employee.monthlySalary / 30 : 0;
                    setStep2Data(prev => ({
                      ...prev,
                      cesantia: {
                        ...prev.cesantia,
                        days,
                        amount: Math.round(days * dailySalary),
                        override: true
                      }
                    }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={step2Data.cesantia.amount}
                  onChange={(e) => {
                    setStep2Data(prev => ({
                      ...prev,
                      cesantia: {
                        ...prev.cesantia,
                        amount: parseInt(e.target.value) || 0,
                        override: true
                      }
                    }));
                  }}
                />
              </div>
            </div>
            {step2Data.cesantia.maxApplied && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se aplicó el tope máximo de {legalParameters.maxSeverance} salarios mensuales
                </AlertDescription>
              </Alert>
            )}
            <div className="text-xs text-muted-foreground">
              Según matriz legal vigente
            </div>
          </div>
        </Card>
      </div>

      {/* Pendientes del período */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Pendientes del Período</h4>
        <div className="space-y-3">
          {step2Data.pendientes.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Concepto"
                value={item.concept}
                onChange={(e) => {
                  const newPendientes = [...step2Data.pendientes];
                  newPendientes[index].concept = e.target.value;
                  setStep2Data(prev => ({ ...prev, pendientes: newPendientes }));
                }}
              />
              <Input
                type="number"
                placeholder="Monto"
                value={item.amount}
                onChange={(e) => {
                  const newPendientes = [...step2Data.pendientes];
                  newPendientes[index].amount = parseInt(e.target.value) || 0;
                  setStep2Data(prev => ({ ...prev, pendientes: newPendientes }));
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newPendientes = step2Data.pendientes.filter((_, i) => i !== index);
                  setStep2Data(prev => ({ ...prev, pendientes: newPendientes }));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              setStep2Data(prev => ({
                ...prev,
                pendientes: [...prev.pendientes, { concept: '', amount: 0, source: 'manual' }]
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Pendiente
          </Button>
        </div>
      </Card>

      {/* Otros ingresos */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Otros Ingresos</h4>
        <div className="space-y-3">
          {step2Data.otrosIngresos.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Concepto"
                value={item.concept}
                onChange={(e) => {
                  const newOtros = [...step2Data.otrosIngresos];
                  newOtros[index].concept = e.target.value;
                  setStep2Data(prev => ({ ...prev, otrosIngresos: newOtros }));
                }}
              />
              <Input
                type="number"
                placeholder="Monto"
                value={item.amount}
                onChange={(e) => {
                  const newOtros = [...step2Data.otrosIngresos];
                  newOtros[index].amount = parseInt(e.target.value) || 0;
                  setStep2Data(prev => ({ ...prev, otrosIngresos: newOtros }));
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newOtros = step2Data.otrosIngresos.filter((_, i) => i !== index);
                  setStep2Data(prev => ({ ...prev, otrosIngresos: newOtros }));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              setStep2Data(prev => ({
                ...prev,
                otrosIngresos: [...prev.otrosIngresos, { concept: '', amount: 0 }]
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Ingreso
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          3
        </div>
        <h3 className="text-lg font-semibold">Deducciones Finales</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CCSS */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3">CCSS Trabajador</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Base</Label>
                <Input
                  type="number"
                  value={step3Data.ccssEmployee.base}
                  onChange={(e) => {
                    const base = parseInt(e.target.value) || 0;
                    setStep3Data(prev => ({
                      ...prev,
                      ccssEmployee: {
                        ...prev.ccssEmployee,
                        base,
                        amount: Math.round(base * prev.ccssEmployee.rate)
                      }
                    }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Monto ({(legalParameters.ccssEmployee * 100).toFixed(1)}%)</Label>
                <Input
                  type="number"
                  value={step3Data.ccssEmployee.amount}
                  onChange={(e) => {
                    setStep3Data(prev => ({
                      ...prev,
                      ccssEmployee: {
                        ...prev.ccssEmployee,
                        amount: parseInt(e.target.value) || 0
                      }
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Impuesto de Renta */}
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Impuesto de Renta</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Base Imponible</Label>
                <Input
                  type="number"
                  value={step3Data.impuestoRenta.base}
                  onChange={(e) => {
                    const base = parseInt(e.target.value) || 0;
                    const tax = calculateIncomeTax(base);
                    setStep3Data(prev => ({
                      ...prev,
                      impuestoRenta: {
                        ...prev.impuestoRenta,
                        base,
                        amount: Math.round(tax.amount)
                      }
                    }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  value={step3Data.impuestoRenta.amount}
                  onChange={(e) => {
                    setStep3Data(prev => ({
                      ...prev,
                      impuestoRenta: {
                        ...prev.impuestoRenta,
                        amount: parseInt(e.target.value) || 0
                      }
                    }));
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                Tramos de renta según parámetros
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Embargos */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Embargos y Retenciones Judiciales</h4>
        <div className="space-y-3">
          {step3Data.embargos.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Concepto"
                value={item.concept}
                onChange={(e) => {
                  const newEmbargos = [...step3Data.embargos];
                  newEmbargos[index].concept = e.target.value;
                  setStep3Data(prev => ({ ...prev, embargos: newEmbargos }));
                }}
              />
              <Input
                type="number"
                placeholder="Monto"
                value={item.amount}
                onChange={(e) => {
                  const newEmbargos = [...step3Data.embargos];
                  newEmbargos[index].amount = parseInt(e.target.value) || 0;
                  setStep3Data(prev => ({ ...prev, embargos: newEmbargos }));
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newEmbargos = step3Data.embargos.filter((_, i) => i !== index);
                  setStep3Data(prev => ({ ...prev, embargos: newEmbargos }));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              setStep3Data(prev => ({
                ...prev,
                embargos: [...prev.embargos, { concept: '', amount: 0 }]
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Embargo
          </Button>
        </div>
      </Card>

      {/* Préstamos */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Préstamos y Adelantos</h4>
        <div className="space-y-3">
          {step3Data.prestamos.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Concepto"
                value={item.concept}
                onChange={(e) => {
                  const newPrestamos = [...step3Data.prestamos];
                  newPrestamos[index].concept = e.target.value;
                  setStep3Data(prev => ({ ...prev, prestamos: newPrestamos }));
                }}
              />
              <Input
                type="number"
                placeholder="Monto"
                value={item.amount}
                onChange={(e) => {
                  const newPrestamos = [...step3Data.prestamos];
                  newPrestamos[index].amount = parseInt(e.target.value) || 0;
                  setStep3Data(prev => ({ ...prev, prestamos: newPrestamos }));
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newPrestamos = step3Data.prestamos.filter((_, i) => i !== index);
                  setStep3Data(prev => ({ ...prev, prestamos: newPrestamos }));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              setStep3Data(prev => ({
                ...prev,
                prestamos: [...prev.prestamos, { concept: '', amount: 0 }]
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Préstamo
          </Button>
        </div>
      </Card>

      {/* Otras deducciones */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Otras Deducciones</h4>
        <div className="space-y-3">
          {step3Data.otrasDeducciones.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Concepto"
                value={item.concept}
                onChange={(e) => {
                  const newOtras = [...step3Data.otrasDeducciones];
                  newOtras[index].concept = e.target.value;
                  setStep3Data(prev => ({ ...prev, otrasDeducciones: newOtras }));
                }}
              />
              <Input
                type="number"
                placeholder="Monto"
                value={item.amount}
                onChange={(e) => {
                  const newOtras = [...step3Data.otrasDeducciones];
                  newOtras[index].amount = parseInt(e.target.value) || 0;
                  setStep3Data(prev => ({ ...prev, otrasDeducciones: newOtras }));
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newOtras = step3Data.otrasDeducciones.filter((_, i) => i !== index);
                  setStep3Data(prev => ({ ...prev, otrasDeducciones: newOtras }));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              setStep3Data(prev => ({
                ...prev,
                otrasDeducciones: [...prev.otrasDeducciones, { concept: '', amount: 0 }]
              }));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Deducción
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          4
        </div>
        <h3 className="text-lg font-semibold">Resumen y Ajustes</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h4 className="font-semibold mb-4 text-navy">Resumen de Ingresos</h4>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Vacaciones:</span>
              <span className="font-mono">{formatCurrency(step2Data.vacaciones.amount, 'CRC')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Aguinaldo:</span>
              <span className="font-mono">{formatCurrency(step2Data.aguinaldo.amount, 'CRC')}</span>
            </div>
            {step2Data.preaviso.amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Preaviso:</span>
                <span className="font-mono">{formatCurrency(step2Data.preaviso.amount, 'CRC')}</span>
              </div>
            )}
            {step2Data.cesantia.amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Cesantía:</span>
                <span className="font-mono">{formatCurrency(step2Data.cesantia.amount, 'CRC')}</span>
              </div>
            )}
            {step2Data.pendientes.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Pendientes:</span>
                <span className="font-mono">
                  {formatCurrency(step2Data.pendientes.reduce((sum, item) => sum + item.amount, 0), 'CRC')}
                </span>
              </div>
            )}
            {step2Data.otrosIngresos.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Otros Ingresos:</span>
                <span className="font-mono">
                  {formatCurrency(step2Data.otrosIngresos.reduce((sum, item) => sum + item.amount, 0), 'CRC')}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-teal">
              <span>Total Ingresos:</span>
              <span className="font-mono">{formatCurrency(step4Data.totalIngresos, 'CRC')}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4 text-navy">Resumen de Deducciones</h4>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>CCSS Trabajador:</span>
              <span className="font-mono">{formatCurrency(step3Data.ccssEmployee.amount, 'CRC')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Impuesto Renta:</span>
              <span className="font-mono">{formatCurrency(step3Data.impuestoRenta.amount, 'CRC')}</span>
            </div>
            {step3Data.embargos.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Embargos:</span>
                <span className="font-mono">
                  {formatCurrency(step3Data.embargos.reduce((sum, item) => sum + item.amount, 0), 'CRC')}
                </span>
              </div>
            )}
            {step3Data.prestamos.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Préstamos:</span>
                <span className="font-mono">
                  {formatCurrency(step3Data.prestamos.reduce((sum, item) => sum + item.amount, 0), 'CRC')}
                </span>
              </div>
            )}
            {step3Data.otrasDeducciones.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Otras Deducciones:</span>
                <span className="font-mono">
                  {formatCurrency(step3Data.otrasDeducciones.reduce((sum, item) => sum + item.amount, 0), 'CRC')}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-orange-600">
              <span>Total Deducciones:</span>
              <span className="font-mono">{formatCurrency(step4Data.totalDeducciones, 'CRC')}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Ajuste final */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Ajuste Final</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ajusteAmount">Monto del Ajuste (± )</Label>
            <Input
              id="ajusteAmount"
              type="number"
              value={step4Data.ajusteFinal.amount}
              onChange={(e) => {
                setStep4Data(prev => ({
                  ...prev,
                  ajusteFinal: {
                    ...prev.ajusteFinal,
                    amount: parseInt(e.target.value) || 0
                  }
                }));
              }}
            />
          </div>
          <div>
            <Label htmlFor="ajusteReason">Motivo del Ajuste</Label>
            <Input
              id="ajusteReason"
              placeholder="Explicar el motivo del ajuste..."
              value={step4Data.ajusteFinal.reason}
              onChange={(e) => {
                setStep4Data(prev => ({
                  ...prev,
                  ajusteFinal: {
                    ...prev.ajusteFinal,
                    reason: e.target.value
                  }
                }));
              }}
            />
          </div>
        </div>
      </Card>

      {/* Total a pagar */}
      <Card className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 border-2 border-teal-200">
        <div className="text-center">
          <h3 className="text-xl font-bold text-navy mb-2">TOTAL A PAGAR</h3>
          <div className="text-3xl font-bold text-teal mb-4">
            {formatCurrency(step4Data.totalPagar, 'CRC')}
          </div>
          <div className="text-sm text-muted-foreground">
            Neto después de deducciones y ajustes
          </div>
        </div>
      </Card>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          5
        </div>
        <h3 className="text-lg font-semibold">Emisión y Archivo</h3>
      </div>

      <Card className="p-6">
        <h4 className="font-semibold mb-4">Documentos de Liquidación</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={handleGeneratePDF}
          >
            <FileText className="h-6 w-6" />
            <span>Carta de Liquidación</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2"
            onClick={handleGeneratePDF}
          >
            <Download className="h-6 w-6" />
            <span>Recibo/Finiquito</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold mb-4">Acciones Finales</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            variant="outline"
            onClick={handleSaveDraft}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar Borrador
          </Button>
          <Button 
            className="gradient-navy text-white"
            onClick={handleApprove}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Aprobar Liquidación
          </Button>
          <Button 
            variant="outline"
            onClick={handleSendEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar por Correo
          </Button>
        </div>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Una vez aprobada la liquidación, no podrá ser modificada. Asegúrese de revisar todos los cálculos y datos antes de continuar.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderWizard = () => (
    <Dialog open={showWizard} onOpenChange={setShowWizard}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {editingLiquidation ? 'Editar Liquidación' : 'Nueva Liquidación'}
          </DialogTitle>
        </DialogHeader>

        {/* Progress tabs */}
        <Tabs value={currentStep.toString()} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="1" className="text-xs">Datos</TabsTrigger>
            <TabsTrigger value="2" className="text-xs">Ingresos</TabsTrigger>
            <TabsTrigger value="3" className="text-xs">Deducciones</TabsTrigger>
            <TabsTrigger value="4" className="text-xs">Resumen</TabsTrigger>
            <TabsTrigger value="5" className="text-xs">Emisión</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="1">{renderStep1()}</TabsContent>
            <TabsContent value="2">{renderStep2()}</TabsContent>
            <TabsContent value="3">{renderStep3()}</TabsContent>
            <TabsContent value="4">{renderStep4()}</TabsContent>
            <TabsContent value="5">{renderStep5()}</TabsContent>
          </div>
        </Tabs>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Borrador
            </Button>
            
            {currentStep < 5 ? (
              <Button onClick={handleNext}>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                className="gradient-navy text-white"
                onClick={() => {
                  handleApprove();
                  setShowWizard(false);
                  resetWizard();
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Liquidaciones
          </h1>
          <p className="text-muted-foreground">
            Cálculo de prestaciones laborales - {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              resetWizard();
              setShowWizard(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Liquidación
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Liquidations Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Liquidaciones Generadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Empleado</TableHead>
                  <TableHead className="font-semibold">Fecha Corte</TableHead>
                  <TableHead className="font-semibold">Causal</TableHead>
                  <TableHead className="font-semibold text-right">Vacaciones</TableHead>
                  <TableHead className="font-semibold text-right">Aguinaldo</TableHead>
                  <TableHead className="font-semibold text-right">Cesantía</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.map((liquidation) => (
                  <TableRow key={liquidation.id} className="hover:bg-muted/25">
                    <TableCell>
                      <div>
                        <div className="font-medium">{liquidation.employeeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {liquidation.employeeCedula}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(liquidation.terminationDate)}</TableCell>
                    <TableCell>{liquidation.cause}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.step2?.vacaciones?.amount || 0, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.step2?.aguinaldo?.amount || 0, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.step2?.cesantia?.amount || 0, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-navy">
                      {formatCurrency(liquidation.step4?.totalPagar || 0, 'CRC')}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(liquidation.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingLiquidation(liquidation.id);
                            setShowWizard(true);
                          }}
                          title="Ver/Editar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={handleGeneratePDF}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={handleSendEmail}
                          title="Enviar por correo"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        {liquidation.status === 'calculated' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            onClick={handleApprove}
                            title="Aprobar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legal Information */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Matriz de Cesantía - Costa Rica 2025</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Años de Servicio - Días de Cesantía</h4>
              <div className="space-y-2 text-sm">
                {legalParameters.severanceMatrix.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>
                      {index === legalParameters.severanceMatrix.length - 1 
                        ? `${item.years} años o más:` 
                        : `${item.years} año${item.years > 1 ? 's' : ''} a menos de ${legalParameters.severanceMatrix[index + 1]?.years || item.years + 1}:`
                      }
                    </span>
                    <span className="font-mono">{item.days} días</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Límites y Consideraciones</h4>
              <div className="space-y-2 text-sm">
                <p>• <strong>Tope máximo:</strong> {legalParameters.maxSeverance} salarios mensuales</p>
                <p>• <strong>Vacaciones:</strong> {legalParameters.vacationDaysPerMonth} días por mes trabajado</p>
                <p>• <strong>Aguinaldo:</strong> Proporcional del período {legalParameters.aguinaldoPeriod.start} al {legalParameters.aguinaldoPeriod.end}</p>
                <p>• <strong>CCSS:</strong> {(legalParameters.ccssEmployee * 100).toFixed(1)}% trabajador</p>
                <p className="text-muted-foreground italic">
                  *Los cálculos son referenciales. Consulte asesoría legal.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wizard Dialog */}
      {renderWizard()}
    </div>
  );
}