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
  Calculator
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate, calculateDailySalary, calculateHourlySalary } from "@/lib/utils";

interface Contract {
  id: string;
  employeeName: string;
  contractType: string;
  paymentPeriod: string;
  workdayType: string;
  baseSalary: number;
  currency: string;
  startDate: string;
  endDate?: string;
  overtimeRate: number;
  status: 'active' | 'expired' | 'terminated';
}

export function Contracts() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const getContractsData = (): Contract[] => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      return [
        {
          id: '1',
          employeeName: 'Andrés Hidalgo Vega',
          contractType: 'Indefinido',
          paymentPeriod: 'Quincenal',
          workdayType: 'Diurna',
          baseSalary: 3301433,
          currency: 'CRC',
          startDate: '2024-01-15',
          overtimeRate: 1.50,
          status: 'active'
        },
        {
          id: '2',
          employeeName: 'María González Rojas',
          contractType: 'Indefinido',
          paymentPeriod: 'Quincenal',
          workdayType: 'Diurna',
          baseSalary: 850000,
          currency: 'CRC',
          startDate: '2024-02-01',
          overtimeRate: 1.50,
          status: 'active'
        }
      ];
    }

    return [
      {
        id: '1',
        employeeName: 'Gabriel Cordero González',
        contractType: 'Indefinido',
        paymentPeriod: 'Mensual',
        workdayType: 'Diurna',
        baseSalary: 2424480,
        currency: 'CRC',
        startDate: '2020-03-01',
        overtimeRate: 1.50,
        status: 'active'
      },
      {
        id: '2',
        employeeName: 'Krissya Paulina Gutiérrez Solís',
        contractType: 'Indefinido',
        paymentPeriod: 'Mensual',
        workdayType: 'Diurna',
        baseSalary: 606120,
        currency: 'CRC',
        startDate: '2021-06-15',
        overtimeRate: 1.50,
        status: 'active'
      }
    ];
  };

  const contracts = getContractsData();
  
  const filteredContracts = contracts.filter(contract =>
    contract.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            {t('nav.contracts')}
          </h1>
          <p className="text-muted-foreground">
            Gestión de contratos laborales para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <Plus className="h-4 w-4" />
            Nuevo Contrato
          </Button>
        </div>
      </div>

      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre de empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Contratos Laborales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Empleado</TableHead>
                  <TableHead className="font-semibold">Tipo Contrato</TableHead>
                  <TableHead className="font-semibold">Período Pago</TableHead>
                  <TableHead className="font-semibold">Jornada</TableHead>
                  <TableHead className="font-semibold text-right">Salario Base</TableHead>
                  <TableHead className="font-semibold text-right">Salario Diario</TableHead>
                  <TableHead className="font-semibold text-right">Salario Hora</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-muted/25">
                    <TableCell className="font-medium">
                      {contract.employeeName}
                    </TableCell>
                    <TableCell>{contract.contractType}</TableCell>
                    <TableCell>{contract.paymentPeriod}</TableCell>
                    <TableCell>{contract.workdayType}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(contract.baseSalary, contract.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-teal">
                      {formatCurrency(calculateDailySalary(contract.baseSalary), contract.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-teal">
                      {formatCurrency(calculateHourlySalary(calculateDailySalary(contract.baseSalary)), contract.currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={contract.status === 'active' ? 'default' : 'secondary'}
                        className={contract.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                      >
                        {contract.status === 'active' ? 'Vigente' : 'Terminado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Editar contrato"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Calcular proyecciones"
                        >
                          <Calculator className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Eliminar contrato"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cálculo de Contratos - Proyecciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">NÓMINA TOTAL</h3>
              <div className="text-2xl font-bold text-teal">
                {formatCurrency(contracts.reduce((acc, contract) => acc + contract.baseSalary, 0), 'CRC')}
              </div>
              <div className="text-sm text-muted-foreground">
                Salarios base mensuales
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">CONTRATOS ACTIVOS</h3>
              <div className="text-2xl font-bold text-teal">
                {contracts.filter(c => c.status === 'active').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Total vigentes
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">COSTO HORA PROMEDIO</h3>
              <div className="text-2xl font-bold text-teal">
                {formatCurrency(
                  contracts.reduce((acc, contract) => acc + calculateHourlySalary(calculateDailySalary(contract.baseSalary)), 0) / contracts.length,
                  'CRC'
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Promedio por empleado
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}