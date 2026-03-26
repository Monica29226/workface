import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  User,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  job_title: string | null;
  hire_date: string | null;
  base_salary: number;
  currency: string;
  vac_balance_days: number | null;
}

interface Liquidation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  terminationDate: string;
  cause: string;
  causeLabel: string;
  currency: string;
  hireDate: string;
  baseSalary: number;
  yearsWorked: number;
  vacationDays: number;
  vacationAmount: number;
  aguinaldoAmount: number;
  preaviso: number;
  cesantia: number;
  totalDeductions: number;
  totalToPay: number;
  status: 'draft' | 'calculated' | 'approved' | 'closed';
  createdDate: string;
  exchangeRate?: number;
}

const CAUSE_OPTIONS = [
  { value: "renuncia", label: "Renuncia Voluntaria", hasCesantia: false, hasPreaviso: false },
  { value: "despido_con_causa", label: "Despido con Responsabilidad Patronal", hasCesantia: true, hasPreaviso: true },
  { value: "despido_sin_causa", label: "Despido sin Responsabilidad Patronal", hasCesantia: false, hasPreaviso: false },
  { value: "mutuo_acuerdo", label: "Mutuo Acuerdo", hasCesantia: true, hasPreaviso: false },
  { value: "vencimiento", label: "Vencimiento de Contrato", hasCesantia: true, hasPreaviso: false },
];

export function Liquidaciones() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [showNewLiquidation, setShowNewLiquidation] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [cause, setCause] = useState('');
  const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);

  // Fetch real employees from DB
  useEffect(() => {
    if (selectedCompany?.id) {
      fetchEmployees();
    }
  }, [selectedCompany?.id]);

  const fetchEmployees = async () => {
    if (!selectedCompany?.id) return;
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, work_email, job_title, hire_date, base_salary, currency, vac_balance_days")
        .eq("company_id", selectedCompany.id)
        .eq("status", "activo")
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const calculateYearsWorked = (hireDate: string, termDate: string): number => {
    const start = new Date(hireDate);
    const end = new Date(termDate);
    return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  };

  const calculateVacationDays = (hireDate: string, termDate: string, balanceDays: number): number => {
    // Use actual balance from DB if available, otherwise calculate
    return balanceDays > 0 ? balanceDays : 0;
  };

  const calculatePreaviso = (yearsWorked: number, monthlySalary: number, cause: string): number => {
    const causeOption = CAUSE_OPTIONS.find(c => c.value === cause);
    if (!causeOption?.hasPreaviso) return 0;
    
    const dailySalary = monthlySalary / 30;
    if (yearsWorked < 0.25) return dailySalary * 7;   // 1 week
    if (yearsWorked < 1) return dailySalary * 15;      // 15 days
    return monthlySalary;                               // 1 month
  };

  const calculateSeverance = (yearsWorked: number, monthlySalary: number, cause: string): number => {
    const causeOption = CAUSE_OPTIONS.find(c => c.value === cause);
    if (!causeOption?.hasCesantia) return 0;
    
    let severanceDays = 0;
    if (yearsWorked < 0.25) severanceDays = 0;
    else if (yearsWorked < 0.5) severanceDays = 7;
    else if (yearsWorked < 1) severanceDays = 14;
    else if (yearsWorked < 2) severanceDays = 19.5;
    else if (yearsWorked < 3) severanceDays = 20;
    else if (yearsWorked < 4) severanceDays = 20.5;
    else if (yearsWorked < 5) severanceDays = 21;
    else severanceDays = 21.24;
    
    const dailySalary = monthlySalary / 30;
    const maxAmount = 8 * monthlySalary;
    return Math.min(severanceDays * dailySalary * Math.min(Math.floor(yearsWorked), 12), maxAmount);
  };

  const handleCalculate = () => {
    if (!selectedEmployee || !terminationDate || !cause) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee || !employee.hire_date) {
      toast({ title: "Error", description: "Empleado sin fecha de ingreso.", variant: "destructive" });
      return;
    }

    const yearsWorked = calculateYearsWorked(employee.hire_date, terminationDate);
    const vacationDays = calculateVacationDays(employee.hire_date, terminationDate, Number(employee.vac_balance_days || 0));
    const dailySalary = employee.base_salary / 30;
    const vacationAmount = Math.round(vacationDays * dailySalary);

    // Aguinaldo proporcional: from Dec 1 to termination date
    const termDate = new Date(terminationDate);
    const aguinaldoStartMonth = termDate.getMonth() >= 11 ? 11 : 11; // Dec = 11
    const aguinaldoStart = new Date(termDate.getMonth() >= 11 ? termDate.getFullYear() : termDate.getFullYear() - 1, 11, 1);
    const monthsWorkedInPeriod = Math.max(0, (termDate.getTime() - aguinaldoStart.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    const aguinaldoAmount = Math.round((employee.base_salary / 12) * Math.min(monthsWorkedInPeriod, 12));

    const preaviso = Math.round(calculatePreaviso(yearsWorked, employee.base_salary, cause));
    const cesantia = Math.round(calculateSeverance(yearsWorked, employee.base_salary, cause));
    const totalToPay = vacationAmount + aguinaldoAmount + preaviso + cesantia;

    const causeLabel = CAUSE_OPTIONS.find(c => c.value === cause)?.label || cause;

    const newLiquidation: Liquidation = {
      id: Date.now().toString(),
      employeeId: selectedEmployee,
      employeeName: employee.full_name,
      employeeEmail: employee.work_email,
      terminationDate,
      cause,
      causeLabel,
      currency: employee.currency,
      hireDate: employee.hire_date,
      baseSalary: employee.base_salary,
      yearsWorked,
      vacationDays,
      vacationAmount,
      aguinaldoAmount,
      preaviso,
      cesantia,
      totalDeductions: 0,
      totalToPay,
      status: 'calculated',
      createdDate: new Date().toISOString().split('T')[0],
    };

    setLiquidations(prev => [...prev, newLiquidation]);
    setShowNewLiquidation(false);
    setSelectedEmployee('');
    setCause('');

    toast({
      title: "Liquidación calculada",
      description: `Liquidación para ${employee.full_name} — ${formatCurrency(totalToPay, employee.currency)}`,
    });
  };

  const fmtCurr = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : '₡';
    return `${symbol}${amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleGeneratePDF = (liq: Liquidation) => {
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) return;
    const symbol = liq.currency === 'USD' ? '$' : '₡';
    pdfWindow.document.write(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Liquidación - ${liq.employeeName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; line-height: 1.6; color: #1a1a2e; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F2A44; padding-bottom: 20px; }
        .company-name { font-size: 22px; font-weight: bold; color: #0F2A44; }
        .title { font-size: 18px; margin: 20px 0; color: #0F2A44; text-align: center; text-transform: uppercase; }
        .info-box { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #0F2A44; }
        table.calc { width: 100%; border-collapse: collapse; margin: 15px 0; }
        table.calc th, table.calc td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        table.calc th { background: #f0f0f0; }
        .amount { text-align: right; font-family: monospace; }
        .total-row { background: #e8f4f8; font-weight: bold; font-size: 1.1em; }
        .currency-badge { display: inline-block; background: ${liq.currency === 'USD' ? '#dbeafe' : '#dcfce7'}; color: ${liq.currency === 'USD' ? '#1e40af' : '#166534'}; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 40px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 15px; }
        .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
        .sig-box { border-top: 1px solid #333; padding-top: 8px; text-align: center; }
      </style></head><body>
      <div class="header">
        <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
        <p>Cédula Jurídica: ${selectedCompany?.tax_id || 'N/A'}</p>
      </div>
      <div class="title">Carta de Liquidación Laboral</div>
      <div class="info-box">
        <p><strong>Colaborador:</strong> ${liq.employeeName}</p>
        <p><strong>Puesto:</strong> ${employees.find(e => e.id === liq.employeeId)?.job_title || '—'}</p>
        <p><strong>Fecha Ingreso:</strong> ${formatDate(liq.hireDate)}</p>
        <p><strong>Fecha Corte:</strong> ${formatDate(liq.terminationDate)}</p>
        <p><strong>Antigüedad:</strong> ${liq.yearsWorked.toFixed(2)} años</p>
        <p><strong>Causal:</strong> ${liq.causeLabel}</p>
        <p><strong>Salario Mensual:</strong> <span class="currency-badge">${liq.currency}</span> ${fmtCurr(liq.baseSalary, liq.currency)}</p>
      </div>
      <table class="calc">
        <thead><tr><th>Concepto</th><th>Detalle</th><th style="text-align:right">Monto (${liq.currency})</th></tr></thead>
        <tbody>
          <tr><td>Vacaciones no disfrutadas</td><td>${liq.vacationDays.toFixed(1)} días</td><td class="amount">${fmtCurr(liq.vacationAmount, liq.currency)}</td></tr>
          <tr><td>Aguinaldo proporcional</td><td>—</td><td class="amount">${fmtCurr(liq.aguinaldoAmount, liq.currency)}</td></tr>
          ${liq.preaviso > 0 ? `<tr><td>Preaviso</td><td>—</td><td class="amount">${fmtCurr(liq.preaviso, liq.currency)}</td></tr>` : ''}
          ${liq.cesantia > 0 ? `<tr><td>Cesantía</td><td>—</td><td class="amount">${fmtCurr(liq.cesantia, liq.currency)}</td></tr>` : ''}
          <tr class="total-row"><td colspan="2"><strong>TOTAL A PAGAR</strong></td><td class="amount"><strong>${fmtCurr(liq.totalToPay, liq.currency)}</strong></td></tr>
        </tbody>
      </table>
      <div class="sig-section">
        <div><div class="sig-box">Firma del Colaborador<br/>${liq.employeeName}</div></div>
        <div><div class="sig-box">Representante de la Empresa<br/>${selectedCompany?.name}</div></div>
      </div>
      <div class="footer">
        <p>Los cálculos se basan en la legislación laboral costarricense vigente. Consulte con su asesor legal.</p>
        <p>Generado el ${formatDate(new Date().toISOString())} • ${selectedCompany?.name} • ACL Workforce HUB</p>
      </div>
      </body></html>
    `);
    pdfWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Borrador</Badge>;
      case 'calculated': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Calculada</Badge>;
      case 'approved': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprobada</Badge>;
      case 'closed': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Cerrada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">Seleccione una empresa para ver liquidaciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Liquidaciones</h1>
          <p className="text-muted-foreground">
            Cálculo de prestaciones laborales — {selectedCompany.name}
            {selectedCompany.base_currency && (
              <Badge variant="outline" className="ml-2">{selectedCompany.base_currency}</Badge>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowNewLiquidation(!showNewLiquidation)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Liquidación
        </Button>
      </div>

      {/* Calculator */}
      {showNewLiquidation && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculadora de Liquidación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Empleado *</Label>
                  {loadingEmployees ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>
                  ) : (
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name} — {emp.currency} {fmtCurr(emp.base_salary, emp.currency)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Corte *</Label>
                  <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Causal de Terminación *</Label>
                  <Select value={cause} onValueChange={setCause}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar causal..." /></SelectTrigger>
                    <SelectContent>
                      {CAUSE_OPTIONS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                {selectedEmployee && (() => {
                  const emp = employees.find(e => e.id === selectedEmployee);
                  if (!emp) return null;
                  return (
                    <Card className="p-4 bg-muted/25">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" /> Información del Empleado
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Puesto:</span><span className="font-medium">{emp.job_title || '—'}</span></div>
                        <div className="flex justify-between"><span>Fecha Ingreso:</span><span className="font-medium">{emp.hire_date ? formatDate(emp.hire_date) : '—'}</span></div>
                        <div className="flex justify-between"><span>Moneda:</span><Badge variant="outline">{emp.currency}</Badge></div>
                        <div className="flex justify-between"><span>Salario Mensual:</span><span className="font-medium">{fmtCurr(emp.base_salary, emp.currency)}</span></div>
                        <div className="flex justify-between"><span>Vacaciones Pendientes:</span><span className="font-medium">{Number(emp.vac_balance_days || 0).toFixed(1)} días</span></div>
                        {terminationDate && emp.hire_date && (
                          <>
                            <Separator className="my-2" />
                            <div className="flex justify-between"><span>Antigüedad:</span><span className="font-medium">{calculateYearsWorked(emp.hire_date, terminationDate).toFixed(2)} años</span></div>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })()}
                <Button className="w-full" onClick={handleCalculate} disabled={!selectedEmployee || !terminationDate || !cause}>
                  <Calculator className="h-4 w-4 mr-2" /> Calcular Liquidación
                </Button>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Legislación Costarricense:</strong> Vacaciones: saldo acumulado. Aguinaldo: proporcional dic-nov. 
                Cesantía: según matriz MTSS. Los cálculos son referenciales.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Liquidaciones Generadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {liquidations.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p>No hay liquidaciones generadas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Empleado</TableHead>
                  <TableHead>Fecha Corte</TableHead>
                  <TableHead>Causal</TableHead>
                  <TableHead className="text-center">Moneda</TableHead>
                  <TableHead className="text-right">Vacaciones</TableHead>
                  <TableHead className="text-right">Aguinaldo</TableHead>
                  <TableHead className="text-right">Preaviso</TableHead>
                  <TableHead className="text-right">Cesantía</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.map(liq => (
                  <TableRow key={liq.id} className="hover:bg-muted/25">
                    <TableCell>
                      <div>
                        <p className="font-medium">{liq.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{liq.yearsWorked.toFixed(1)} años</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(liq.terminationDate)}</TableCell>
                    <TableCell className="text-sm">{liq.causeLabel}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{liq.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurr(liq.vacationAmount, liq.currency)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtCurr(liq.aguinaldoAmount, liq.currency)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{liq.preaviso > 0 ? fmtCurr(liq.preaviso, liq.currency) : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{liq.cesantia > 0 ? fmtCurr(liq.cesantia, liq.currency) : '—'}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtCurr(liq.totalToPay, liq.currency)}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(liq.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedLiquidation(liq)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGeneratePDF(liq)} title="Descargar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLiquidation} onOpenChange={() => setSelectedLiquidation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Liquidación</DialogTitle>
          </DialogHeader>
          {selectedLiquidation && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Colaborador</p><p className="font-medium">{selectedLiquidation.employeeName}</p></div>
                <div><p className="text-muted-foreground">Moneda</p><Badge variant="outline">{selectedLiquidation.currency}</Badge></div>
                <div><p className="text-muted-foreground">Fecha Ingreso</p><p>{formatDate(selectedLiquidation.hireDate)}</p></div>
                <div><p className="text-muted-foreground">Fecha Corte</p><p>{formatDate(selectedLiquidation.terminationDate)}</p></div>
                <div><p className="text-muted-foreground">Antigüedad</p><p>{selectedLiquidation.yearsWorked.toFixed(2)} años</p></div>
                <div><p className="text-muted-foreground">Causal</p><p>{selectedLiquidation.causeLabel}</p></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between"><span>Salario Mensual:</span><span className="font-mono">{fmtCurr(selectedLiquidation.baseSalary, selectedLiquidation.currency)}</span></div>
                <div className="flex justify-between"><span>Vacaciones ({selectedLiquidation.vacationDays.toFixed(1)} días):</span><span className="font-mono">{fmtCurr(selectedLiquidation.vacationAmount, selectedLiquidation.currency)}</span></div>
                <div className="flex justify-between"><span>Aguinaldo proporcional:</span><span className="font-mono">{fmtCurr(selectedLiquidation.aguinaldoAmount, selectedLiquidation.currency)}</span></div>
                {selectedLiquidation.preaviso > 0 && <div className="flex justify-between"><span>Preaviso:</span><span className="font-mono">{fmtCurr(selectedLiquidation.preaviso, selectedLiquidation.currency)}</span></div>}
                {selectedLiquidation.cesantia > 0 && <div className="flex justify-between"><span>Cesantía:</span><span className="font-mono">{fmtCurr(selectedLiquidation.cesantia, selectedLiquidation.currency)}</span></div>}
                <Separator />
                <div className="flex justify-between text-base font-bold"><span>TOTAL A PAGAR:</span><span className="font-mono">{fmtCurr(selectedLiquidation.totalToPay, selectedLiquidation.currency)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legal Matrix */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Matriz de Cesantía — Costa Rica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Años de Servicio → Días de Cesantía</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>3 a 6 meses:</span><span className="font-mono">7 días</span></div>
                <div className="flex justify-between"><span>6 meses a 1 año:</span><span className="font-mono">14 días</span></div>
                <div className="flex justify-between"><span>1 a 2 años:</span><span className="font-mono">19.5 días</span></div>
                <div className="flex justify-between"><span>2 a 3 años:</span><span className="font-mono">20 días</span></div>
                <div className="flex justify-between"><span>3 a 4 años:</span><span className="font-mono">20.5 días</span></div>
                <div className="flex justify-between"><span>4 a 5 años:</span><span className="font-mono">21 días</span></div>
                <div className="flex justify-between"><span>5+ años:</span><span className="font-mono">21.24 días</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Consideraciones</h4>
              <div className="space-y-2 text-sm">
                <p>• <strong>Tope máximo:</strong> 8 salarios mensuales</p>
                <p>• <strong>Vacaciones:</strong> Saldo acumulado real del colaborador</p>
                <p>• <strong>Aguinaldo:</strong> Proporcional del período dic-nov</p>
                <p>• <strong>Preaviso:</strong> Solo aplica con responsabilidad patronal</p>
                <p>• <strong>Moneda:</strong> Se calcula en la moneda del contrato</p>
                <p className="text-muted-foreground italic">*Consulte asesoría legal para casos específicos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
