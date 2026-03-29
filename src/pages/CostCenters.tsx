import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Search, 
  Download, 
  Upload, 
  Edit, 
  Trash2,
  Building2,
  Users,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export function CostCenters() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch cost centers from database filtered by selected company
  const { data: costCenters = [], isLoading, error } = useQuery({
    queryKey: ['cost-centers', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');
      
      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!selectedCompany?.id
  });

  // Fetch employee counts per cost center
  const { data: employeeCounts = {} } = useQuery({
    queryKey: ['employee-counts-by-cost-center', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return {};
      
      const { data, error } = await supabase
        .from('employees')
        .select('cost_center_id')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'activo');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(emp => {
        if (emp.cost_center_id) {
          counts[emp.cost_center_id] = (counts[emp.cost_center_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!selectedCompany?.id
  });

  const filteredCostCenters = costCenters.filter(cc =>
    `${cc.name} ${cc.code} ${cc.description || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalEmployees = Object.values(employeeCounts).reduce((sum, count) => sum + count, 0);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Seleccione una empresa para ver sus centros de costo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Centros de Costo
          </h1>
          <p className="text-muted-foreground">
            Gestión de centros de costo - {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CRUD buttons removed — not yet implemented */}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Centros</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-navy">{costCenters.length}</div>
                <p className="text-xs text-muted-foreground">
                  {costCenters.filter(cc => cc.is_active).length} activos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Asignados a centros</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Asignar</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  {costCenters.filter(cc => !cc.is_active).length}
                </div>
                <p className="text-xs text-muted-foreground">Centros inactivos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Centers Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Detalle de Centros de Costo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Error al cargar los centros de costo</p>
            </div>
          ) : filteredCostCenters.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No hay centros de costo</p>
              <p className="text-sm">
                {searchTerm 
                  ? "No se encontraron resultados para la búsqueda" 
                  : "Cree un nuevo centro de costo para comenzar"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Código</TableHead>
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold">Descripción</TableHead>
                    <TableHead className="font-semibold text-center">Empleados</TableHead>
                    <TableHead className="font-semibold text-center">Estado</TableHead>
                    <TableHead className="font-semibold text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCostCenters.map((costCenter) => (
                    <TableRow key={costCenter.id} className="hover:bg-muted/25">
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {costCenter.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{costCenter.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {costCenter.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {employeeCounts[costCenter.id] || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={costCenter.is_active 
                          ? "bg-green-100 text-green-800 hover:bg-green-100" 
                          : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                        }>
                          {costCenter.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground text-sm">—</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Distribution */}
      {costCenters.length > 0 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy">Distribución de Empleados por Centro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costCenters.filter(cc => cc.is_active).map((cc) => (
                <div key={cc.id} className="flex items-center justify-between p-3 bg-muted/25 rounded">
                  <div>
                    <div className="font-medium">{cc.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Código: {cc.code}
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    {employeeCounts[cc.id] || 0} empleados
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
