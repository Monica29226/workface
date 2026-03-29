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
  Calculator,
  FileText
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, calculateDailySalary, calculateHourlySalary } from "@/lib/utils";

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

  // No contracts data - waiting for real data to be uploaded
  const contracts: Contract[] = [];
  
  const filteredContracts = contracts.filter(contract =>
    contract.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('nav.contracts')}
          </h1>
          <p className="text-muted-foreground">
            Gestión de contratos laborales para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Buttons removed — contract CRUD not yet implemented */}
        </div>
      </div>

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Contratos Laborales</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay contratos registrados
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Comienza importando contratos desde un archivo CSV o creando nuevos contratos manualmente.
              </p>
              <p className="text-sm">
                La gestión de contratos estará disponible próximamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {contract.employeeName}
                      </TableCell>
                      <TableCell>{contract.contractType}</TableCell>
                      <TableCell>{contract.paymentPeriod}</TableCell>
                      <TableCell>{contract.workdayType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(contract.baseSalary, contract.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(calculateDailySalary(contract.baseSalary), contract.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(calculateHourlySalary(calculateDailySalary(contract.baseSalary)), contract.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={contract.status === 'active' ? 'default' : 'secondary'}
                        >
                          {contract.status === 'active' ? 'Vigente' : 'Terminado'}
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

      {contracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cálculo de Contratos - Proyecciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">NÓMINA TOTAL</h3>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(contracts.reduce((acc, contract) => acc + contract.baseSalary, 0), 'CRC')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Salarios base mensuales
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">CONTRATOS ACTIVOS</h3>
                <div className="text-2xl font-bold text-primary">
                  {contracts.filter(c => c.status === 'active').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total vigentes
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">COSTO HORA PROMEDIO</h3>
                <div className="text-2xl font-bold text-primary">
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
      )}
    </div>
  );
}
