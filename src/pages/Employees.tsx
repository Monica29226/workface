import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  base_salary: number;
  hourly_rate: number | null;
  hire_date: string | null;
  contract_type: string;
  currency: string;
  status: string;
  company_id: string;
  vac_balance_days: number;
  aguinaldo_base_12m: number;
}

interface Company {
  id: string;
  display_name: string;
  base_currency: string;
}

export function Employees() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    work_email: '',
    base_salary: '',
    hourly_rate: '',
    hire_date: '',
    contract_type: 'mensual',
    currency: 'CRC',
    company_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, display_name, base_currency')
        .order('display_name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('employees').insert([{
        employee_id: formData.employee_id,
        company_id: formData.company_id,
        full_name: formData.full_name,
        work_email: formData.work_email,
        base_salary: parseFloat(formData.base_salary),
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        hire_date: formData.hire_date || null,
        contract_type: formData.contract_type as 'mensual' | 'por_horas',
        currency: formData.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
        status: 'activo' as 'activo' | 'inactivo',
      }]);

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "Empleado creado correctamente",
      });

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el empleado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      full_name: '',
      work_email: '',
      base_salary: '',
      hourly_rate: '',
      hire_date: '',
      contract_type: 'mensual',
      currency: 'CRC',
      company_id: '',
    });
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.display_name || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Empleados</h1>
          <p className="text-muted-foreground">Gestión de colaboradores del sistema</p>
        </div>

        {(role === 'admin' || role === 'company_manager') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Empleado</DialogTitle>
                <DialogDescription>
                  Complete la información del nuevo colaborador
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_id">ID Empleado *</Label>
                    <Input
                      id="employee_id"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      placeholder="EMP-001"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_id">Empresa *</Label>
                    <Select
                      value={formData.company_id}
                      onValueChange={(value) => {
                        const company = companies.find(c => c.id === value);
                        setFormData({ 
                          ...formData, 
                          company_id: value,
                          currency: company?.base_currency || 'CRC'
                        });
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Juan Pérez Rodríguez"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_email">Correo Electrónico *</Label>
                  <Input
                    id="work_email"
                    type="email"
                    value={formData.work_email}
                    onChange={(e) => setFormData({ ...formData, work_email: e.target.value })}
                    placeholder="juan.perez@empresa.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contract_type">Tipo de Contrato *</Label>
                    <Select
                      value={formData.contract_type}
                      onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensual">Mensual</SelectItem>
                        <SelectItem value="por_horas">Por Horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda *</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRC">CRC - Colones</SelectItem>
                        <SelectItem value="USD">USD - Dólares</SelectItem>
                        <SelectItem value="EUR">EUR - Euros</SelectItem>
                        <SelectItem value="GBP">GBP - Libras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_salary">Salario Base *</Label>
                    <Input
                      id="base_salary"
                      type="number"
                      step="0.01"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">Tarifa por Hora</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hire_date">Fecha de Contratación</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Empleado'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Employees Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-primary">Lista de Empleados</CardTitle>
          <CardDescription>
            {employees.length} empleado{employees.length !== 1 ? 's' : ''} registrado{employees.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo Contrato</TableHead>
                  <TableHead>Salario Base</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Vacaciones</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No hay empleados registrados. Agregue el primer empleado usando el botón "Nuevo Empleado".
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-mono text-xs">{employee.employee_id}</TableCell>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{getCompanyName(employee.company_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{employee.work_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(employee.base_salary, employee.currency)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{employee.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{employee.vac_balance_days.toFixed(2)} días</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'activo' ? 'default' : 'secondary'}>
                          {employee.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
