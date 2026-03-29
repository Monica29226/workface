import React, { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, FileUpIcon, FileDownIcon, PlusIcon, CheckIcon, XIcon, EditIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TimesheetProyecto {
  id: string;
  company_id: string;
  employee_id?: string;
  cedula: string;
  nombre: string;
  fecha: string;
  proyecto_codigo: string;
  proyecto_nombre: string;
  centro_costo: string;
  actividad: string;
  horas: number;
  tarifa_hora_crc: number;
  notas: string;
  weekend: boolean;
  feriado: boolean;
  aprobado: boolean;
  fuente: 'manual' | 'import';
  created_by?: string;
  updated_by?: string;
}

interface Filters {
  fechaDesde: string;
  fechaHasta: string;
  empleado: string;
  proyecto: string;
  centroCosto: string;
  estado: string;
  weekend: string;
}

interface ResumenCalculos {
  horasLaborales: number;
  horasSabado: number;
  horasDomingo: number;
  horasFeriado: number;
  costoTotal: number;
  netoEstimado: number;
}

// Datos demo
const demoTimesheets: TimesheetProyecto[] = [
  {
    id: "1",
    company_id: "coT",
    cedula: "12345678",
    nombre: "Juan Pérez Mora",
    fecha: "2025-07-15",
    proyecto_codigo: "PRJ-001",
    proyecto_nombre: "Sistema de Riego Tenorio",
    centro_costo: "CC-MANT",
    actividad: "Instalación tuberías",
    horas: 8,
    tarifa_hora_crc: 3500,
    notas: "",
    weekend: false,
    feriado: false,
    aprobado: false,
    fuente: 'manual'
  },
  {
    id: "2",
    company_id: "coT",
    cedula: "87654321",
    nombre: "María González López",
    fecha: "2025-07-15",
    proyecto_codigo: "PRJ-002",
    proyecto_nombre: "Mantenimiento Estación Norte",
    centro_costo: "CC-OPER",
    actividad: "Limpieza equipos",
    horas: 6,
    tarifa_hora_crc: 3200,
    notas: "",
    weekend: false,
    feriado: false,
    aprobado: true,
    fuente: 'manual'
  },
  {
    id: "3",
    company_id: "coT",
    cedula: "12345678",
    nombre: "Juan Pérez Mora",
    fecha: "2025-07-19",
    proyecto_codigo: "PRJ-001",
    proyecto_nombre: "Sistema de Riego Tenorio",
    centro_costo: "CC-MANT",
    actividad: "Instalación tuberías",
    horas: 4,
    tarifa_hora_crc: 5250, // 3500 * 1.5 (sábado)
    notas: "Horas extras sábado",
    weekend: true,
    feriado: false,
    aprobado: false,
    fuente: 'manual'
  }
];

export function HorasProyecto() {
  const { language } = useLanguage();
  const { selectedCompany } = useCompany();
  const [timesheets, setTimesheets] = useState<TimesheetProyecto[]>(demoTimesheets);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimesheetProyecto | null>(null);
  const [filters, setFilters] = useState<Filters>({
    fechaDesde: "2025-07-01",
    fechaHasta: "2025-07-31",
    empleado: "",
    proyecto: "",
    centroCosto: "",
    estado: "",
    weekend: ""
  });

  const texts = {
    es: {
      title: "Clasificación de horas por proyecto",
      subtitle: "Alturas de Tenorio - Gestión de horas por proyecto y centro de costo",
      filters: "Filtros",
      fechaDesde: "Fecha desde",
      fechaHasta: "Fecha hasta",
      empleado: "Empleado",
      proyecto: "Proyecto",
      centroCosto: "Centro de Costo",
      estado: "Estado",
      weekend: "Fin de semana",
      todos: "Todos",
      pendiente: "Pendiente",
      aprobado: "Aprobado",
      si: "Sí",
      no: "No",
      actions: "Acciones",
      addRow: "Añadir fila",
      importData: "Importar",
      validate: "Validar",
      approveSelected: "Aprobar selección",
      export: "Exportar",
      fecha: "Fecha",
      cedula: "Cédula",
      nombre: "Nombre",
      proyectoCodigo: "Proyecto",
      centroCostoCol: "Centro Costo",
      actividad: "Actividad",
      horas: "Horas",
      tarifaHora: "Tarifa/H (₡)",
      notas: "Notas",
      flags: "Flags",
      resumenCalculos: "Resumen de Cálculos",
      horasLaborales: "Horas laborales",
      horasSabado: "Horas sábado",
      horasDomingo: "Horas domingo",
      horasFeriado: "Horas feriado",
      costoTotal: "Costo total (₡)",
      netoEstimado: "Neto estimado (₡)",
      resumenEmpleado: "Resumen por Empleado-Proyecto",
      resumenProyecto: "Resumen por Proyecto",
      editRow: "Editar fila",
      guardar: "Guardar",
      cancelar: "Cancelar",
      success: "Operación exitosa",
      error: "Error en la operación"
    },
    en: {
      title: "Project hour classification",
      subtitle: "Alturas de Tenorio - Project and cost center hour management",
      filters: "Filters",
      fechaDesde: "From date",
      fechaHasta: "To date",
      empleado: "Employee",
      proyecto: "Project",
      centroCosto: "Cost Center",
      estado: "Status",
      weekend: "Weekend",
      todos: "All",
      pendiente: "Pending",
      aprobado: "Approved",
      si: "Yes",
      no: "No",
      actions: "Actions",
      addRow: "Add row",
      importData: "Import",
      validate: "Validate",
      approveSelected: "Approve selection",
      export: "Export",
      fecha: "Date",
      cedula: "ID",
      nombre: "Name",
      proyectoCodigo: "Project",
      centroCostoCol: "Cost Center",
      actividad: "Activity",
      horas: "Hours",
      tarifaHora: "Rate/H (₡)",
      notas: "Notes",
      flags: "Flags",
      resumenCalculos: "Calculation Summary",
      horasLaborales: "Regular hours",
      horasSabado: "Saturday hours",
      horasDomingo: "Sunday hours",
      horasFeriado: "Holiday hours",
      costoTotal: "Total cost (₡)",
      netoEstimado: "Estimated net (₡)",
      resumenEmpleado: "Employee-Project Summary",
      resumenProyecto: "Project Summary",
      editRow: "Edit row",
      guardar: "Save",
      cancelar: "Cancel",
      success: "Operation successful",
      error: "Operation error"
    }
  };

  const t = texts[language];

  // Filtrar timesheets
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(item => {
      const matchesFecha = (!filters.fechaDesde || item.fecha >= filters.fechaDesde) &&
                          (!filters.fechaHasta || item.fecha <= filters.fechaHasta);
      const matchesEmpleado = !filters.empleado || 
                             item.nombre.toLowerCase().includes(filters.empleado.toLowerCase()) ||
                             item.cedula.includes(filters.empleado);
      const matchesProyecto = !filters.proyecto || 
                             item.proyecto_codigo.toLowerCase().includes(filters.proyecto.toLowerCase()) ||
                             item.proyecto_nombre.toLowerCase().includes(filters.proyecto.toLowerCase());
      const matchesCentroCosto = !filters.centroCosto || 
                                item.centro_costo.toLowerCase().includes(filters.centroCosto.toLowerCase());
      const matchesEstado = !filters.estado || 
                           (filters.estado === 'aprobado' && item.aprobado) ||
                           (filters.estado === 'pendiente' && !item.aprobado);
      const matchesWeekend = !filters.weekend || 
                            (filters.weekend === 'si' && item.weekend) ||
                            (filters.weekend === 'no' && !item.weekend);

      return matchesFecha && matchesEmpleado && matchesProyecto && matchesCentroCosto && matchesEstado && matchesWeekend;
    });
  }, [timesheets, filters]);

  // Calcular resumen para filas seleccionadas
  const resumenCalculos = useMemo((): ResumenCalculos => {
    const selectedTimesheets = selectedRows.length > 0 
      ? filteredTimesheets.filter(item => selectedRows.includes(item.id))
      : filteredTimesheets;

    const resumen = selectedTimesheets.reduce((acc, item) => {
      if (item.feriado) {
        acc.horasFeriado += item.horas;
        acc.costoTotal += item.horas * item.tarifa_hora_crc;
      } else if (item.weekend) {
        const dayOfWeek = new Date(item.fecha).getDay();
        if (dayOfWeek === 6) { // Sábado
          acc.horasSabado += item.horas;
        } else if (dayOfWeek === 0) { // Domingo
          acc.horasDomingo += item.horas;
        }
        acc.costoTotal += item.horas * item.tarifa_hora_crc;
      } else {
        acc.horasLaborales += item.horas;
        acc.costoTotal += item.horas * item.tarifa_hora_crc;
      }
      return acc;
    }, {
      horasLaborales: 0,
      horasSabado: 0,
      horasDomingo: 0,
      horasFeriado: 0,
      costoTotal: 0,
      netoEstimado: 0
    });

    // Calcular neto estimado (asumiendo descuentos del 18% aprox)
    resumen.netoEstimado = resumen.costoTotal * 0.82;

    return resumen;
  }, [filteredTimesheets, selectedRows]);

  const handleRowSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedRows(prev => [...prev, id]);
    } else {
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRows(filteredTimesheets.map(item => item.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleEdit = (item: TimesheetProyecto) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleSave = () => {
    if (!editingItem) return;

    setTimesheets(prev => prev.map(item => 
      item.id === editingItem.id ? editingItem : item
    ));
    setIsEditModalOpen(false);
    setEditingItem(null);
    toast({
      title: t.success,
      description: "Registro actualizado correctamente"
    });
  };

  const handleApproveSelected = () => {
    if (selectedRows.length === 0) {
      toast({
        title: t.error,
        description: "Seleccione al menos una fila para aprobar"
      });
      return;
    }

    setTimesheets(prev => prev.map(item => 
      selectedRows.includes(item.id) ? { ...item, aprobado: true } : item
    ));
    setSelectedRows([]);
    toast({
      title: t.success,
      description: `${selectedRows.length} registros aprobados`
    });
  };

  const handleAddRow = () => {
    const newId = (timesheets.length + 1).toString();
    const newTimesheet: TimesheetProyecto = {
      id: newId,
      company_id: "coT",
      cedula: "",
      nombre: "",
      fecha: format(new Date(), 'yyyy-MM-dd'),
      proyecto_codigo: "",
      proyecto_nombre: "",
      centro_costo: "",
      actividad: "",
      horas: 0,
      tarifa_hora_crc: 3500,
      notas: "",
      weekend: false,
      feriado: false,
      aprobado: false,
      fuente: 'manual'
    };
    setTimesheets(prev => [...prev, newTimesheet]);
    handleEdit(newTimesheet);
  };

  const validateHours = () => {
    const dailyHours = new Map<string, number>();
    
    filteredTimesheets.forEach(item => {
      const key = `${item.cedula}-${item.fecha}`;
      dailyHours.set(key, (dailyHours.get(key) || 0) + item.horas);
    });

    const violations = Array.from(dailyHours.entries()).filter(([, hours]) => hours > 8);
    
    if (violations.length > 0) {
      toast({
        title: "Validación de horas",
        description: `${violations.length} empleados superan las 8 horas diarias`
      });
    } else {
      toast({
        title: t.success,
        description: "Todas las horas están dentro de los límites permitidos"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t.filters}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div>
              <Label>{t.fechaDesde}</Label>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => setFilters(prev => ({ ...prev, fechaDesde: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t.fechaHasta}</Label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => setFilters(prev => ({ ...prev, fechaHasta: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t.empleado}</Label>
              <Input
                placeholder="Nombre o cédula..."
                value={filters.empleado}
                onChange={(e) => setFilters(prev => ({ ...prev, empleado: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t.proyecto}</Label>
              <Input
                placeholder="Código o nombre..."
                value={filters.proyecto}
                onChange={(e) => setFilters(prev => ({ ...prev, proyecto: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t.centroCosto}</Label>
              <Input
                placeholder="Centro de costo..."
                value={filters.centroCosto}
                onChange={(e) => setFilters(prev => ({ ...prev, centroCosto: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t.estado}</Label>
              <Select value={filters.estado} onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t.todos} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.todos}</SelectItem>
                  <SelectItem value="pendiente">{t.pendiente}</SelectItem>
                  <SelectItem value="aprobado">{t.aprobado}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.weekend}</Label>
              <Select value={filters.weekend} onValueChange={(value) => setFilters(prev => ({ ...prev, weekend: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t.todos} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.todos}</SelectItem>
                  <SelectItem value="si">{t.si}</SelectItem>
                  <SelectItem value="no">{t.no}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAddRow} size="sm">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  {t.addRow}
                </Button>
                <Button variant="outline" size="sm" onClick={validateHours}>
                  <CheckIcon className="w-4 h-4 mr-2" />
                  {t.validate}
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleApproveSelected}
                  disabled={selectedRows.length === 0}
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  {t.approveSelected} ({selectedRows.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === filteredTimesheets.length && filteredTimesheets.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead>{t.fecha}</TableHead>
                      <TableHead>{t.cedula}</TableHead>
                      <TableHead>{t.nombre}</TableHead>
                      <TableHead>{t.proyectoCodigo}</TableHead>
                      <TableHead>{t.centroCostoCol}</TableHead>
                      <TableHead>{t.actividad}</TableHead>
                      <TableHead className="text-right">{t.horas}</TableHead>
                      <TableHead className="text-right">{t.tarifaHora}</TableHead>
                      <TableHead>{t.flags}</TableHead>
                      <TableHead>{t.notas}</TableHead>
                      <TableHead className="w-20">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTimesheets.map((item) => (
                      <TableRow key={item.id} className={item.aprobado ? "bg-green-50 dark:bg-green-950/20" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(item.id)}
                            onChange={(e) => handleRowSelect(item.id, e.target.checked)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>{format(new Date(item.fecha), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{item.cedula}</TableCell>
                        <TableCell>{item.nombre}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{item.proyecto_codigo}</div>
                            <div className="text-muted-foreground">{item.proyecto_nombre}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.centro_costo}</TableCell>
                        <TableCell>{item.actividad}</TableCell>
                        <TableCell className="text-right font-medium">{item.horas}</TableCell>
                        <TableCell className="text-right">₡{item.tarifa_hora_crc.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.weekend && <Badge variant="secondary">W</Badge>}
                            {item.feriado && <Badge variant="destructive">F</Badge>}
                            {item.aprobado && <Badge variant="default">A</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-32 truncate text-sm text-muted-foreground">
                            {item.notas}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            disabled={item.aprobado}
                          >
                            <EditIcon className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.resumenCalculos}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">{t.horasLaborales}:</span>
                  <span className="font-medium">{resumenCalculos.horasLaborales}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">{t.horasSabado}:</span>
                  <span className="font-medium">{resumenCalculos.horasSabado}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">{t.horasDomingo}:</span>
                  <span className="font-medium">{resumenCalculos.horasDomingo}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">{t.horasFeriado}:</span>
                  <span className="font-medium">{resumenCalculos.horasFeriado}h</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t.costoTotal}:</span>
                  <span className="font-bold">₡{resumenCalculos.costoTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t.netoEstimado}:</span>
                  <span className="text-muted-foreground">₡{resumenCalculos.netoEstimado.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reportes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileDownIcon className="w-4 h-4 mr-2" />
                {t.resumenEmpleado}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileDownIcon className="w-4 h-4 mr-2" />
                {t.resumenProyecto}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.editRow}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={editingItem.fecha}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, fecha: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Cédula</Label>
                <Input
                  value={editingItem.cedula}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, cedula: e.target.value } : null)}
                />
              </div>
              <div className="col-span-2">
                <Label>Nombre completo</Label>
                <Input
                  value={editingItem.nombre}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Proyecto código</Label>
                <Input
                  value={editingItem.proyecto_codigo}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, proyecto_codigo: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Centro de costo</Label>
                <Input
                  value={editingItem.centro_costo}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, centro_costo: e.target.value } : null)}
                />
              </div>
              <div className="col-span-2">
                <Label>Proyecto nombre</Label>
                <Input
                  value={editingItem.proyecto_nombre}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, proyecto_nombre: e.target.value } : null)}
                />
              </div>
              <div className="col-span-2">
                <Label>Actividad</Label>
                <Input
                  value={editingItem.actividad}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, actividad: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Horas</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingItem.horas}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, horas: parseFloat(e.target.value) || 0 } : null)}
                />
              </div>
              <div>
                <Label>Tarifa hora (₡)</Label>
                <Input
                  type="number"
                  min="0"
                  value={editingItem.tarifa_hora_crc}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, tarifa_hora_crc: parseFloat(e.target.value) || 0 } : null)}
                />
              </div>
              <div className="col-span-2">
                <Label>Notas</Label>
                <Textarea
                  value={editingItem.notas}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, notas: e.target.value } : null)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingItem.weekend}
                  onCheckedChange={(checked) => setEditingItem(prev => prev ? { ...prev, weekend: checked } : null)}
                />
                <Label>Fin de semana</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingItem.feriado}
                  onCheckedChange={(checked) => setEditingItem(prev => prev ? { ...prev, feriado: checked } : null)}
                />
                <Label>Feriado</Label>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  {t.cancelar}
                </Button>
                <Button onClick={handleSave}>
                  {t.guardar}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}