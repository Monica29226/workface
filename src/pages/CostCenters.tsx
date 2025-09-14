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
  BarChart3,
  Users,
  DollarSign
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  description?: string;
  manager?: string;
  employeeCount: number;
  monthlyBudget: number;
  actualExpense: number;
  active: boolean;
}

export function CostCenters() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const getCostCentersData = (): CostCenter[] => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      return [
        {
          id: '1',
          name: 'Administración',
          code: 'ADM',
          description: 'Gestión administrativa y gerencial',
          manager: 'Andrés Hidalgo Vega',
          employeeCount: 1,
          monthlyBudget: 4000000,
          actualExpense: 3301433,
          active: true
        },
        {
          id: '2',
          name: 'Operaciones',
          code: 'OPS',
          description: 'Operaciones de campo y turismo',
          manager: 'María González Rojas',
          employeeCount: 2,
          monthlyBudget: 2000000,
          actualExpense: 1500000,
          active: true
        }
      ];
    }

    return [
      {
        id: '1',
        name: 'Administración',
        code: 'ADM',
        description: 'Gestión administrativa general',
        manager: 'Gabriel Cordero González',
        employeeCount: 2,
        monthlyBudget: 3500000,
        actualExpense: 3055855,
        active: true
      },
      {
        id: '2',
        name: 'Programas',
        code: 'PROG',
        description: 'Programas sociales y comunitarios',
        manager: 'David Marín Mora',
        employeeCount: 3,
        monthlyBudget: 2500000,
        actualExpense: 2414460,
        active: true
      }
    ];
  };

  const costCenters = getCostCentersData();
  
  const filteredCostCenters = costCenters.filter(cc =>
    `${cc.name} ${cc.code} ${cc.manager || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const calculateBudgetUsage = (actual: number, budget: number) => {
    const percentage = (actual / budget) * 100;
    return {
      percentage,
      status: percentage > 100 ? 'over' : percentage > 85 ? 'warning' : 'good'
    };
  };

  const getBudgetBadge = (actual: number, budget: number) => {
    const usage = calculateBudgetUsage(actual, budget);
    const percentage = usage.percentage.toFixed(1);
    
    switch (usage.status) {
      case 'over':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sobrepasado {percentage}%</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Alerta {percentage}%</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Normal {percentage}%</Badge>;
    }
  };

  const totalBudget = costCenters.reduce((sum, cc) => sum + cc.monthlyBudget, 0);
  const totalActual = costCenters.reduce((sum, cc) => sum + cc.actualExpense, 0);
  const totalEmployees = costCenters.reduce((sum, cc) => sum + cc.employeeCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Centros de Costo
          </h1>
          <p className="text-muted-foreground">
            Gestión presupuestaria y control de costos - {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <Plus className="h-4 w-4" />
            Nuevo Centro
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Centros</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-navy">{costCenters.length}</div>
            <p className="text-xs text-muted-foreground">Activos</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {formatCurrency(totalBudget, 'CRC')}
            </div>
            <p className="text-xs text-muted-foreground">Mensual</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Real</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalActual, 'CRC')}
            </div>
            <p className="text-xs text-muted-foreground">
              {((totalActual / totalBudget) * 100).toFixed(1)}% del presupuesto
            </p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Distribuidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o responsable..."
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
          <CardTitle className="text-navy">Detalle por Centro de Costo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Centro de Costo</TableHead>
                  <TableHead className="font-semibold">Responsable</TableHead>
                  <TableHead className="font-semibold text-center">Empleados</TableHead>
                  <TableHead className="font-semibold text-right">Presupuesto</TableHead>
                  <TableHead className="font-semibold text-right">Gasto Real</TableHead>
                  <TableHead className="font-semibold text-right">Diferencia</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCostCenters.map((costCenter) => {
                  const difference = costCenter.actualExpense - costCenter.monthlyBudget;
                  return (
                    <TableRow key={costCenter.id} className="hover:bg-muted/25">
                      <TableCell>
                        <div>
                          <div className="font-medium">{costCenter.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {costCenter.code} - {costCenter.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{costCenter.manager || 'Sin asignar'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{costCenter.employeeCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(costCenter.monthlyBudget, 'CRC')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatCurrency(costCenter.actualExpense, 'CRC')}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        difference > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {difference > 0 ? '+' : ''}{formatCurrency(difference, 'CRC')}
                      </TableCell>
                      <TableCell className="text-center">
                        {getBudgetBadge(costCenter.actualExpense, costCenter.monthlyBudget)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            title="Editar centro"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            title="Ver detalle"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Budget Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy">Análisis Presupuestario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costCenters.map((cc) => {
                const usage = calculateBudgetUsage(cc.actualExpense, cc.monthlyBudget);
                return (
                  <div key={cc.id} className="flex items-center justify-between p-3 bg-muted/25 rounded">
                    <div>
                      <div className="font-medium">{cc.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(cc.actualExpense, 'CRC')} / {formatCurrency(cc.monthlyBudget, 'CRC')}
                      </div>
                    </div>
                    <div className={`text-right font-bold ${
                      usage.status === 'over' ? 'text-red-600' :
                      usage.status === 'warning' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {usage.percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy">Distribución de Empleados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costCenters.map((cc) => (
                <div key={cc.id} className="flex items-center justify-between p-3 bg-muted/25 rounded">
                  <div>
                    <div className="font-medium">{cc.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Costo promedio: {formatCurrency(cc.actualExpense / cc.employeeCount, 'CRC')} por empleado
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    {cc.employeeCount} empleados
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}