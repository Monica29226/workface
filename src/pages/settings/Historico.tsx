import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileText, Search, Filter, Calendar, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ImportHistoricalPayrollDialog } from "@/components/historico/ImportHistoricalPayrollDialog";

interface HistoricalPayroll {
  id?: string;
  company_id: string;
  employee_id?: string;
  cedula: string;
  nombre: string;
  email: string;
  centro_costo?: string;
  proyecto?: string;
  periodo: string;
  total_crc: number;
  total_usd: number;
  tc?: number;
  fuente: string;
}

interface PivotData {
  empleado: {
    nombre: string;
    cedula: string;
    email: string;
    centro_costo?: string;
  };
  periodos: Record<string, { crc: number; usd: number }>;
  total_crc: number;
  total_usd: number;
}

export function Historico() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [data, setData] = useState<HistoricalPayroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD' | 'BOTH'>('BOTH');
  const [periodFilter, setPeriodFilter] = useState({ desde: '', hasta: '' });
  const [searchFilter, setSearchFilter] = useState('');
  const [centroFilter, setCentroFilter] = useState('todos');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'pivot' | 'detail'>('pivot');

  useEffect(() => {
    if (selectedCompany?.id) {
      loadHistoricalData();
    }
  }, [selectedCompany?.id]);

  const loadHistoricalData = async () => {
    if (!selectedCompany?.id) return;
    
    setLoading(true);
    try {
      // Load payroll lines from approved/sent batches
      const { data: payrollLines, error } = await supabase
        .from('payroll_lines')
        .select(`
          *,
          employee:employees!inner(
            full_name,
            employee_id,
            work_email
          ),
          batch:payroll_batches!inner(
            period_start,
            period_end,
            batch_id,
            status,
            base_currency
          )
        `)
        .eq('company_id', selectedCompany.id)
        .in('batch.status', ['aprobado', 'enviado']);

      if (error) throw error;

      // Transform to historical payroll format
      const historicalData: HistoricalPayroll[] = (payrollLines || []).map((line: any) => {
        const periodo = line.batch.period_start.substring(0, 7); // YYYY-MM format
        const exchangeRate = line.exchange_rate_to_base || 505.10;
        
        // net_pay is stored in the line's currency
        // If currency is USD: net_pay is in USD, calculate CRC equivalent
        // If currency is CRC: net_pay is in CRC, calculate USD equivalent
        let total_crc: number;
        let total_usd: number;
        
        if (line.currency === 'USD') {
          total_usd = line.net_pay;
          total_crc = line.net_pay * exchangeRate;
        } else {
          total_crc = line.net_pay;
          total_usd = line.net_pay / exchangeRate;
        }
        
        return {
          id: line.id,
          company_id: line.company_id,
          employee_id: line.employee_id,
          cedula: line.employee.employee_id,
          nombre: line.employee.full_name,
          email: line.employee.work_email,
          centro_costo: '', // TODO: Add cost center if available
          proyecto: '', // TODO: Add project if available
          periodo: periodo,
          total_crc,
          total_usd,
          tc: exchangeRate,
          fuente: 'payroll_lines'
        };
      });

      // Apply period filters
      let filtered = historicalData;
      if (periodFilter.desde) {
        filtered = filtered.filter(item => item.periodo >= periodFilter.desde);
      }
      if (periodFilter.hasta) {
        filtered = filtered.filter(item => item.periodo <= periodFilter.hasta);
      }

      setData(filtered);
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos históricos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and process data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = !searchFilter || 
        item.nombre.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.cedula.includes(searchFilter) ||
        item.email.toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchesCentro = centroFilter === 'todos' || item.centro_costo === centroFilter;
      
      return matchesSearch && matchesCentro;
    });
  }, [data, searchFilter, centroFilter]);

  // Create pivot data
  const pivotData = useMemo(() => {
    const grouped: Record<string, PivotData> = {};
    
    filteredData.forEach(item => {
      const key = `${item.cedula}-${item.nombre}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          empleado: {
            nombre: item.nombre,
            cedula: item.cedula,
            email: item.email,
            centro_costo: item.centro_costo
          },
          periodos: {},
          total_crc: 0,
          total_usd: 0
        };
      }
      
      grouped[key].periodos[item.periodo] = {
        crc: item.total_crc,
        usd: item.total_usd
      };
      
      grouped[key].total_crc += item.total_crc;
      grouped[key].total_usd += item.total_usd;
    });
    
    return Object.values(grouped);
  }, [filteredData]);

  // Get unique periods and centers
  const periods = useMemo(() => {
    const periodsSet = new Set(filteredData.map(item => item.periodo));
    return Array.from(periodsSet).sort();
  }, [filteredData]);

  const centrosCosto = useMemo(() => {
    const centrosSet = new Set(filteredData.map(item => item.centro_costo).filter(Boolean));
    return Array.from(centrosSet);
  }, [filteredData]);


  const handleRecalculate = async () => {
    // Implementation for recalculating from approved periods would go here
    toast({
      title: "Recalcular",
      description: "Funcionalidad de recálculo desde períodos aprobados pendiente de implementación",
    });
  };

  const handleExportExcel = () => {
    // Implementation for Excel export would go here
    toast({
      title: "Exportar",
      description: "Funcionalidad de exportación Excel pendiente de implementación",
    });
  };

  const handleSendEmail = (empleado: PivotData['empleado']) => {
    // Implementation for sending email would go here
    toast({
      title: "Enviar correo",
      description: `Funcionalidad de envío de correo a ${empleado.email} pendiente de implementación`,
    });
  };

  const getCurrencyValue = (periodo: string, employee: PivotData) => {
    const data = employee.periodos[periodo];
    if (!data) return '-';
    
    switch (selectedCurrency) {
      case 'CRC':
        return formatCurrency(data.crc, 'CRC');
      case 'USD':
        return formatCurrency(data.usd, 'USD');
      case 'BOTH':
        return (
          <div className="text-center">
            <div>{formatCurrency(data.crc, 'CRC')}</div>
            <div className="text-xs text-muted-foreground">${formatNumber(data.usd)}</div>
          </div>
        );
      default:
        return '-';
    }
  };

  const getTotalValue = (employee: PivotData) => {
    switch (selectedCurrency) {
      case 'CRC':
        return formatCurrency(employee.total_crc, 'CRC');
      case 'USD':
        return formatCurrency(employee.total_usd, 'USD');
      case 'BOTH':
        return (
          <div className="text-center font-semibold">
            <div>{formatCurrency(employee.total_crc, 'CRC')}</div>
            <div className="text-xs text-muted-foreground">${formatNumber(employee.total_usd)}</div>
          </div>
        );
      default:
        return '-';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico (CRC/USD)</h1>
            <p className="text-muted-foreground">Consulta histórica de montos pagados por colaborador</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando datos históricos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico (CRC/USD)</h1>
          <p className="text-muted-foreground">Consulta histórica de montos pagados por colaborador</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRecalculate} variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Recalcular
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <ImportHistoricalPayrollDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
            companyId={selectedCompany?.id || ''}
            companyName={selectedCompany?.name || ''}
            onImportComplete={loadHistoricalData}
          />
          <Button onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Período desde</Label>
              <Input
                type="month"
                value={periodFilter.desde}
                onChange={(e) => setPeriodFilter(prev => ({ ...prev, desde: e.target.value }))}
              />
            </div>
            <div>
              <Label>Período hasta</Label>
              <Input
                type="month"
                value={periodFilter.hasta}
                onChange={(e) => setPeriodFilter(prev => ({ ...prev, hasta: e.target.value }))}
              />
            </div>
            <div>
              <Label>Centro de Costo</Label>
              <Select value={centroFilter} onValueChange={setCentroFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {centrosCosto.map(centro => (
                    <SelectItem key={centro} value={centro}>{centro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre, cédula, email"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={selectedCurrency} onValueChange={(value: 'CRC' | 'USD' | 'BOTH') => setSelectedCurrency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BOTH">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={loadHistoricalData} size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPeriodFilter({ desde: '', hasta: '' });
                setSearchFilter('');
                setCentroFilter('todos');
              }}
            >
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(value: 'pivot' | 'detail') => setViewMode(value)}>
        <TabsList>
          <TabsTrigger value="pivot">Vista Pivot</TabsTrigger>
          <TabsTrigger value="detail">Vista Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="pivot">
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background">
                      <TableHead className="sticky left-0 bg-background z-10">Colaborador</TableHead>
                      <TableHead className="sticky left-0 bg-background z-10 w-32">Cédula</TableHead>
                      <TableHead className="sticky left-0 bg-background z-10 w-48">Email</TableHead>
                      <TableHead className="sticky left-0 bg-background z-10">Centro</TableHead>
                      {periods.map(periodo => (
                        <TableHead key={periodo} className="text-center min-w-32">
                          {periodo}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold bg-green-50">
                        TOTAL {selectedCurrency === 'CRC' ? 'CRC' : selectedCurrency === 'USD' ? 'USD' : ''}
                      </TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pivotData.map((employee, index) => (
                      <TableRow key={`${employee.empleado.cedula}-${index}`}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          {employee.empleado.nombre}
                        </TableCell>
                        <TableCell className="sticky left-0 bg-background z-10 font-mono text-sm">
                          {employee.empleado.cedula}
                        </TableCell>
                        <TableCell className="sticky left-0 bg-background z-10 text-sm">
                          {employee.empleado.email}
                        </TableCell>
                        <TableCell className="sticky left-0 bg-background z-10">
                          {employee.empleado.centro_costo || '-'}
                        </TableCell>
                        {periods.map(periodo => (
                          <TableCell key={periodo} className="text-center">
                            {getCurrencyValue(periodo, employee)}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-green-50">
                          {getTotalValue(employee)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" title="Ver detalle">
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" title="Descargar PDF">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              title="Enviar por correo"
                              onClick={() => handleSendEmail(employee.empleado)}
                            >
                              <Mail className="h-3 w-3" />
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
        </TabsContent>

        <TabsContent value="detail">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Centro de Costo</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Total CRC</TableHead>
                    <TableHead className="text-right">Total USD</TableHead>
                    <TableHead>TC</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => (
                    <TableRow key={`${item.cedula}-${item.periodo}-${index}`}>
                      <TableCell>{item.periodo}</TableCell>
                      <TableCell>{item.nombre}</TableCell>
                      <TableCell className="font-mono text-sm">{item.cedula}</TableCell>
                      <TableCell>{item.centro_costo || '-'}</TableCell>
                      <TableCell>{item.proyecto || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_crc, 'CRC')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_usd, 'USD')}</TableCell>
                      <TableCell>{item.tc || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.fuente === 'aprobado' ? 'default' : 'secondary'}>
                          {item.fuente}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Colaboradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pivotData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total CRC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pivotData.reduce((sum, emp) => sum + emp.total_crc, 0), 'CRC')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total USD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pivotData.reduce((sum, emp) => sum + emp.total_usd, 0), 'USD')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}