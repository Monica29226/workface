import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Search, Edit, Trash2, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ImportEmployeesDialog } from "@/components/employees/ImportEmployeesDialog";

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
  const { selectedCompany } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

  useEffect(() => {
    if (selectedCompany) {
      setFilterCompany(selectedCompany.id);
    }
  }, [selectedCompany]);

  const fetchData = async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, display_name, base_currency')
        .order('display_name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

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
      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update({
            employee_id: formData.employee_id,
            company_id: formData.company_id,
            full_name: formData.full_name,
            work_email: formData.work_email,
            base_salary: parseFloat(formData.base_salary),
            hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
            hire_date: formData.hire_date || null,
            contract_type: formData.contract_type as 'mensual' | 'por_horas',
            currency: formData.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;

        toast({
          title: "¡Éxito!",
          description: "Empleado actualizado correctamente",
        });
      } else {
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
      }

      setDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el empleado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      work_email: employee.work_email,
      base_salary: employee.base_salary.toString(),
      hourly_rate: employee.hourly_rate?.toString() || '',
      hire_date: employee.hire_date || '',
      contract_type: employee.contract_type,
      currency: employee.currency,
      company_id: employee.company_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (employeeId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este empleado?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "Empleado eliminado correctamente",
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el empleado",
        variant: "destructive",
      });
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
      company_id: selectedCompany?.id || '',
    });
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.display_name || 'N/A';
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.work_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCompany = filterCompany === "all" || emp.company_id === filterCompany;
    
    return matchesSearch && matchesCompany;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">
            Gestiona la información de los empleados
          </p>
        </div>
        {(role === 'admin' || role === 'company_manager') && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar desde Excel
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingEmployee(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Empleado
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
                <DialogDescription>
                  {editingEmployee ? 'Actualiza la información del empleado' : 'Completa el formulario para agregar un nuevo empleado'}
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
                    onClick={() => {
                      setDialogOpen(false);
                      setEditingEmployee(null);
                      resetForm();
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingEmployee ? 'Actualizando...' : 'Guardando...'}
                      </>
                    ) : (
                      editingEmployee ? 'Actualizar' : 'Crear Empleado'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <ImportEmployeesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        companyId={selectedCompany?.id || ''}
        onImportComplete={fetchData}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Empleados</CardTitle>
          <CardDescription>
            {filteredEmployees.length} empleado{filteredEmployees.length !== 1 ? 's' : ''} encontrado{filteredEmployees.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, ID o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo Contrato</TableHead>
                  <TableHead className="text-right">Salario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No se encontraron empleados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employee_id}</TableCell>
                      <TableCell>{employee.full_name}</TableCell>
                      <TableCell>{getCompanyName(employee.company_id)}</TableCell>
                      <TableCell>{employee.work_email}</TableCell>
                      <TableCell>
                        <Badge variant={employee.contract_type === 'mensual' ? 'default' : 'secondary'}>
                          {employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(employee.base_salary, employee.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'activo' ? 'default' : 'secondary'}>
                          {employee.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(employee.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
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
