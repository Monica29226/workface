import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Calendar, FileSpreadsheet, RefreshCw, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { differenceInMonths, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";

interface EmployeeVacation {
  id: string;
  employee_id: string;
  full_name: string;
  hire_date: string | null;
  base_salary: number;
  months_worked: number;
  days_accrued: number;
  days_taken: number;
  days_pending: number;
  daily_rate: number;
  pending_amount: number;
  expiry_date: string | null;
  is_expiring_soon: boolean;
}

export function VacationReport() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [vacationData, setVacationData] = useState<EmployeeVacation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (selectedCompany?.id) {
      loadVacationData();
    }
  }, [selectedCompany?.id, selectedYear]);

  const loadVacationData = async () => {
    if (!selectedCompany?.id) return;

    setIsLoading(true);
    try {
      // Get company parameters for vacation settings
      const { data: params } = await supabase
        .from('company_parameters')
        .select('vacation_monthly_accrual, vacation_expiry_months')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      const monthlyAccrual = params?.vacation_monthly_accrual || 1;
      const expiryMonths = params?.vacation_expiry_months || 12;

      // Get employees with their vacation data
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, full_name, hire_date, base_salary, vac_balance_days')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'activo')
        .order('full_name');

      if (error) throw error;

      // Get vacation records for this year
      const { data: vacRecords } = await supabase
        .from('employee_vacations')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('year', selectedYear);

      const vacationMap = new Map(vacRecords?.map(v => [v.employee_id, v]) || []);

      // Calculate vacation data for each employee
      const today = new Date();
      const vacationData: EmployeeVacation[] = (employees || []).map(emp => {
        const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
        const monthsWorked = hireDate ? differenceInMonths(today, hireDate) : 0;
        
        // Get existing vacation record or calculate
        const vacRecord = vacationMap.get(emp.id);
        const daysAccrued = vacRecord?.days_accrued || (monthsWorked * monthlyAccrual);
        const daysTaken = vacRecord?.days_taken || 0;
        const daysPending = daysAccrued - daysTaken;

        // Calculate daily rate (monthly salary / 30)
        const dailyRate = emp.base_salary / 30;
        const pendingAmount = daysPending * dailyRate;

        // Calculate expiry date (anniversary + expiry months)
        let expiryDate: string | null = null;
        let isExpiringSoon = false;
        if (hireDate) {
          const anniversary = new Date(selectedYear, hireDate.getMonth(), hireDate.getDate());
          const expiry = addMonths(anniversary, expiryMonths);
          expiryDate = format(expiry, 'yyyy-MM-dd');
          
          // Warning if expiring within 60 days
          const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 60;
        }

        return {
          id: emp.id,
          employee_id: emp.id,
          full_name: emp.full_name,
          hire_date: emp.hire_date,
          base_salary: emp.base_salary,
          months_worked: monthsWorked,
          days_accrued: Math.round(daysAccrued * 100) / 100,
          days_taken: daysTaken,
          days_pending: Math.round(daysPending * 100) / 100,
          daily_rate: dailyRate,
          pending_amount: pendingAmount,
          expiry_date: expiryDate,
          is_expiring_soon: isExpiringSoon,
        };
      });

      setVacationData(vacationData);
    } catch (error) {
      console.error('Error loading vacation data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de vacaciones",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return vacationData.filter(v =>
      v.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vacationData, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      accrued: acc.accrued + item.days_accrued,
      taken: acc.taken + item.days_taken,
      pending: acc.pending + item.days_pending,
      amount: acc.amount + item.pending_amount,
    }), { accrued: 0, taken: 0, pending: 0, amount: 0 });
  }, [filteredData]);

  const expiringCount = filteredData.filter(v => v.is_expiring_soon).length;

  if (!selectedCompany) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Seleccione una empresa para ver el reporte de vacaciones
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reporte de Vacaciones</h1>
          <p className="text-muted-foreground">
            Control de días acumulados, disfrutados y pendientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (!selectedCompany?.id) return;
              try {
                const { data, error } = await (supabase.rpc as any)("recalculate_vacation_accruals", {
                  p_company_id: selectedCompany.id,
                  p_year: selectedYear,
                  p_employee_id: null,
                });
                if (error) throw error;
                toast({
                  title: "Saldos recalculados",
                  description: `${data ?? 0} colaboradores actualizados.`,
                });
                loadVacationData();
              } catch (err: any) {
                toast({
                  title: "Error al recalcular",
                  description: err?.message ?? "No se pudo recalcular",
                  variant: "destructive",
                });
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recalcular saldos
          </Button>
          <Button variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-24"
            min={2020}
            max={2030}
          />
        </div>
        <Button variant="outline" onClick={loadVacationData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Acumulado</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {totals.accrued.toFixed(1)} días
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Días Disfrutados</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {totals.taken.toFixed(1)} días
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Días Pendientes</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {totals.pending.toFixed(1)} días
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Provisión Total</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatCurrency(totals.amount)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Warning for expiring vacations */}
      {expiringCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {expiringCount} colaborador{expiringCount > 1 ? 'es' : ''} con vacaciones próximas a vencer
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Revise los casos marcados para evitar pérdida de días
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Colaborador</CardTitle>
          <CardDescription>
            {filteredData.length} colaboradores activos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Fecha Ingreso</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead className="text-right">Acumulados</TableHead>
                <TableHead className="text-right">Disfrutados</TableHead>
                <TableHead className="text-right">Pendientes</TableHead>
                <TableHead className="text-right">Monto Pendiente</TableHead>
                <TableHead>Vencimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay datos de vacaciones disponibles
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className={item.is_expiring_soon ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.full_name}</span>
                        {item.is_expiring_soon && (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.hire_date ? format(new Date(item.hire_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">{item.months_worked}</TableCell>
                    <TableCell className="text-right">{item.days_accrued.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-green-600">{item.days_taken.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={item.days_pending > 0 ? "font-medium text-amber-600" : "text-green-600"}>
                          {item.days_pending.toFixed(1)}
                        </span>
                        <Progress 
                          value={item.days_accrued > 0 ? (item.days_taken / item.days_accrued) * 100 : 0} 
                          className="h-1 w-16"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.pending_amount)}
                    </TableCell>
                    <TableCell>
                      {item.expiry_date ? (
                        <Badge variant={item.is_expiring_soon ? "destructive" : "secondary"}>
                          {format(new Date(item.expiry_date), 'dd MMM yyyy', { locale: es })}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filteredData.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right">{totals.accrued.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-green-600">{totals.taken.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-amber-600">{totals.pending.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.amount)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default VacationReport;
