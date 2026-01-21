import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, Users } from "lucide-react";

interface ImportPayrollRow {
  cedula: string;
  nombre: string;
  email: string;
  periodo: string;
  salario_bruto: number;
  deducciones: number;
  salario_neto: number;
  currency: string;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
  matchedEmployeeId?: string;
}

interface ImportHistoricalPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onImportComplete: () => void;
}

const REQUIRED_COLUMNS = ['cedula', 'nombre', 'salario_bruto'];
const OPTIONAL_COLUMNS = ['email', 'periodo', 'deducciones', 'salario_neto', 'moneda'];

// Column name mapping: various formats -> normalized snake_case
const COLUMN_ALIASES: Record<string, string> = {
  // cedula variations
  'cedula': 'cedula',
  'cédula': 'cedula',
  'id_empleado': 'cedula',
  'id empleado': 'cedula',
  'employee_id': 'cedula',
  'employee id': 'cedula',
  'codigo': 'cedula',
  'código': 'cedula',
  'identificacion': 'cedula',
  'identificación': 'cedula',
  
  // nombre variations
  'nombre': 'nombre',
  'nombre completo': 'nombre',
  'nombre_completo': 'nombre',
  'full_name': 'nombre',
  'full name': 'nombre',
  'empleado': 'nombre',
  'colaborador': 'nombre',
  
  // email variations
  'email': 'email',
  'correo': 'email',
  'correo electronico': 'email',
  'correo electrónico': 'email',
  'work_email': 'email',
  
  // salario bruto variations
  'salario_bruto': 'salario_bruto',
  'salario bruto': 'salario_bruto',
  'salariobruto': 'salario_bruto',
  'gross_salary': 'salario_bruto',
  'gross salary': 'salario_bruto',
  'bruto': 'salario_bruto',
  'salario': 'salario_bruto',
  'sueldo bruto': 'salario_bruto',
  'sueldo': 'salario_bruto',
  'total bruto': 'salario_bruto',
  'ingreso bruto': 'salario_bruto',
  
  // deducciones variations
  'deducciones': 'deducciones',
  'deduccion': 'deducciones',
  'deducción': 'deducciones',
  'total deducciones': 'deducciones',
  'total_deducciones': 'deducciones',
  'deductions': 'deducciones',
  'descuentos': 'deducciones',
  
  // salario neto variations
  'salario_neto': 'salario_neto',
  'salario neto': 'salario_neto',
  'salarioneto': 'salario_neto',
  'net_pay': 'salario_neto',
  'net pay': 'salario_neto',
  'neto': 'salario_neto',
  'sueldo neto': 'salario_neto',
  'total neto': 'salario_neto',
  'a pagar': 'salario_neto',
  'total a pagar': 'salario_neto',
  
  // periodo variations
  'periodo': 'periodo',
  'período': 'periodo',
  'period': 'periodo',
  'mes': 'periodo',
  'fecha': 'periodo',
  'fecha_pago': 'periodo',
  'fecha pago': 'periodo',
  
  // currency variations
  'moneda': 'currency',
  'currency': 'currency',
  'divisa': 'currency',
};

const VALID_CURRENCIES = ['CRC', 'USD', 'EUR', 'GBP'];

// Normalize column name to snake_case and check aliases
const normalizeColumnName = (columnName: string): string => {
  const cleaned = columnName
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\s]+/g, ' ')
    .trim();
  
  if (COLUMN_ALIASES[cleaned]) {
    return COLUMN_ALIASES[cleaned];
  }
  
  const cleanedForMatch = cleaned.replace(/\s+/g, '');
  for (const [alias, normalized] of Object.entries(COLUMN_ALIASES)) {
    const cleanAlias = alias.replace(/[_\-\s]+/g, '');
    if (cleanAlias === cleanedForMatch) {
      return normalized;
    }
  }
  
  return cleaned.replace(/\s+/g, '_');
};

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remove currency symbols, spaces, and thousands separators
  const cleaned = String(value)
    .replace(/[₡$€£]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parsePeriod = (value: any): string => {
  if (!value) {
    // Default to current month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  const str = String(value).trim();
  
  // Try YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Try MM/YYYY or MM-YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return `${match[2]}-${match[1].padStart(2, '0')}`;
  }
  
  // Try to parse as date
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  // Try "Enero 2026" format
  const monthNames: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  const monthMatch = str.toLowerCase().match(/(\w+)\s*(\d{4})/);
  if (monthMatch && monthNames[monthMatch[1]]) {
    return `${monthMatch[2]}-${monthNames[monthMatch[1]]}`;
  }
  
  // Default to current month
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function ImportHistoricalPayrollDialog({ 
  open, 
  onOpenChange, 
  companyId,
  companyName,
  onImportComplete 
}: ImportHistoricalPayrollDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ImportPayrollRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [employeeMap, setEmployeeMap] = useState<Map<string, { id: string; full_name: string }>>(new Map());
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  });

  const resetState = () => {
    setStep('upload');
    setParsedData([]);
    setProgress(0);
    setIsDragging(false);
    setEmployeeMap(new Map());
    setImportResults({ success: 0, failed: 0, errors: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      await processFile(file);
    }
  };

  const validateRow = (row: Record<string, any>, rowNumber: number, employees: Map<string, { id: string; full_name: string }>): ImportPayrollRow => {
    const errors: string[] = [];
    
    const cedula = String(row.cedula || '').trim();
    const nombre = String(row.nombre || '').trim();
    const email = String(row.email || '').trim();
    const salario_bruto = parseNumber(row.salario_bruto);
    const deducciones = parseNumber(row.deducciones);
    const salario_neto = parseNumber(row.salario_neto) || (salario_bruto - deducciones);
    const periodo = parsePeriod(row.periodo);
    let currency = String(row.currency || 'CRC').toUpperCase().trim();
    
    if (!cedula) errors.push('Cédula es requerida');
    if (!nombre) errors.push('Nombre es requerido');
    if (salario_bruto <= 0) errors.push('Salario bruto debe ser positivo');
    if (!VALID_CURRENCIES.includes(currency)) currency = 'CRC';
    
    // Try to match employee by cedula
    let matchedEmployeeId: string | undefined;
    const employee = employees.get(cedula);
    if (employee) {
      matchedEmployeeId = employee.id;
    } else {
      errors.push(`Empleado con cédula ${cedula} no encontrado en ${companyName}`);
    }
    
    return {
      cedula,
      nombre,
      email,
      periodo,
      salario_bruto,
      deducciones,
      salario_neto,
      currency,
      isValid: errors.length === 0,
      errors,
      rowNumber,
      matchedEmployeeId
    };
  };

  const loadEmployees = async (): Promise<Map<string, { id: string; full_name: string }>> => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('company_id', companyId);
    
    if (error) {
      console.error('Error loading employees:', error);
      return new Map();
    }
    
    const map = new Map<string, { id: string; full_name: string }>();
    (data || []).forEach(emp => {
      map.set(emp.employee_id, { id: emp.id, full_name: emp.full_name });
    });
    return map;
  };

  const processFile = async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV",
        variant: "destructive",
      });
      return;
    }

    try {
      // Load employees for this company first
      const employees = await loadEmployees();
      setEmployeeMap(employees);

      if (employees.size === 0) {
        toast({
          title: "Sin empleados",
          description: `No hay empleados registrados en ${companyName}. Primero importa los empleados.`,
          variant: "destructive",
        });
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

      if (jsonData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo está vacío",
          variant: "destructive",
        });
        return;
      }

      // Check for required columns
      const firstRow = jsonData[0] as Record<string, any>;
      const originalColumns = Object.keys(firstRow);
      
      const columnMapping: Record<string, string> = {};
      originalColumns.forEach(col => {
        columnMapping[col] = normalizeColumnName(col);
      });
      
      const normalizedColumns = Object.values(columnMapping);
      const missingColumns = REQUIRED_COLUMNS.filter(col => !normalizedColumns.includes(col));
      
      if (missingColumns.length > 0) {
        toast({
          title: "Columnas faltantes",
          description: `El archivo debe contener: ${missingColumns.join(', ')}. Columnas encontradas: ${originalColumns.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Normalize and validate data
      const normalizedData = jsonData.map((row: any, index) => {
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = normalizeColumnName(key);
          normalizedRow[normalizedKey] = row[key];
        });
        return validateRow(normalizedRow, index + 2, employees);
      });

      setParsedData(normalizedData);
      setStep('preview');

      toast({
        title: "Archivo cargado",
        description: `${normalizedData.length} filas encontradas. ${employees.size} empleados en ${companyName}.`,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Error",
        description: "Error al leer el archivo. Verifica el formato.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast({
        title: "Error",
        description: "No hay filas válidas para importar",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setStep('importing');
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Group by period to create batches
    const byPeriod = new Map<string, ImportPayrollRow[]>();
    validRows.forEach(row => {
      const existing = byPeriod.get(row.periodo) || [];
      existing.push(row);
      byPeriod.set(row.periodo, existing);
    });

    let processed = 0;
    const totalRows = validRows.length;

    for (const [periodo, rows] of byPeriod) {
      // Create or find batch for this period
      const periodParts = periodo.split('-');
      const year = parseInt(periodParts[0]);
      const month = parseInt(periodParts[1]);
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];
      const batchId = `HIST-${companyId.substring(0, 8)}-${periodo}`;

      // Check if batch already exists
      let batchUuid: string;
      const { data: existingBatch } = await supabase
        .from('payroll_batches')
        .select('id')
        .eq('company_id', companyId)
        .eq('batch_id', batchId)
        .single();

      if (existingBatch) {
        batchUuid = existingBatch.id;
      } else {
        // Create new batch
        const { data: newBatch, error: batchError } = await supabase
          .from('payroll_batches')
          .insert({
            company_id: companyId,
            batch_id: batchId,
            period_start: periodStart,
            period_end: periodEnd,
            frequency: 'mensual',
            status: 'aprobado',
            base_currency: 'CRC'
          })
          .select('id')
          .single();

        if (batchError || !newBatch) {
          errors.push(`Error creando lote para período ${periodo}: ${batchError?.message}`);
          processed += rows.length;
          setProgress(Math.round((processed / totalRows) * 100));
          continue;
        }
        batchUuid = newBatch.id;
      }

      // Insert payroll lines
      for (const row of rows) {
        try {
          const lineId = `HIST-${row.cedula}-${periodo}`;
          
          // Check if line already exists
          const { data: existingLine } = await supabase
            .from('payroll_lines')
            .select('id')
            .eq('batch_id', batchUuid)
            .eq('employee_id', row.matchedEmployeeId!)
            .single();

          if (existingLine) {
            // Update existing line
            const { error: updateError } = await supabase
              .from('payroll_lines')
              .update({
                gross_salary: row.salario_bruto,
                deductions: row.deducciones,
                net_pay: row.salario_neto,
                currency: row.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
              })
              .eq('id', existingLine.id);

            if (updateError) {
              failed++;
              errors.push(`Fila ${row.rowNumber} (${row.nombre}): ${updateError.message}`);
            } else {
              success++;
            }
          } else {
            // Insert new line
            const { error: insertError } = await supabase
              .from('payroll_lines')
              .insert({
                company_id: companyId,
                batch_id: batchUuid,
                employee_id: row.matchedEmployeeId!,
                line_id: lineId,
                gross_salary: row.salario_bruto,
                deductions: row.deducciones,
                net_pay: row.salario_neto,
                currency: row.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
              });

            if (insertError) {
              failed++;
              errors.push(`Fila ${row.rowNumber} (${row.nombre}): ${insertError.message}`);
            } else {
              success++;
            }
          }
        } catch (err: any) {
          failed++;
          errors.push(`Fila ${row.rowNumber} (${row.nombre}): ${err.message}`);
        }

        processed++;
        setProgress(Math.round((processed / totalRows) * 100));
      }
    }

    setImportResults({ success, failed, errors });
    setImporting(false);
    setStep('complete');

    if (success > 0) {
      onImportComplete();
    }
  };

  const validCount = parsedData.filter(row => row.isValid).length;
  const invalidCount = parsedData.filter(row => !row.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Datos Históricos de Planilla
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && (
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Importando para: <strong className="text-foreground">{companyName}</strong>
              </span>
            )}
            {step === 'preview' && `Revisa los ${parsedData.length} registros antes de importar`}
            {step === 'importing' && 'Importando datos...'}
            {step === 'complete' && 'Importación completada'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div 
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-lg font-medium mb-2">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo aquí o haz clic para seleccionar'}
              </p>
              <p className="text-sm text-muted-foreground">
                Formatos soportados: .xlsx, .xls, .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Columnas requeridas:</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  cedula/id_empleado, nombre, salario_bruto
                </code>
                <p className="font-medium mt-2 mb-2">Columnas opcionales:</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  email, periodo (YYYY-MM), deducciones, salario_neto, moneda
                </code>
                <p className="mt-3 text-xs text-muted-foreground">
                  <strong>Importante:</strong> Los empleados deben existir previamente en la empresa "{companyName}". 
                  La cédula se usa para vincular los datos.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {invalidCount} con errores
                </Badge>
              )}
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {employeeMap.size} empleados en {companyName}
              </Badge>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Fila</TableHead>
                    <TableHead className="w-[70px]">Estado</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, index) => (
                    <TableRow key={index} className={!row.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.cedula}</TableCell>
                      <TableCell>{row.nombre}</TableCell>
                      <TableCell>{row.periodo}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.salario_bruto.toLocaleString('es-CR')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.deducciones.toLocaleString('es-CR')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {row.salario_neto.toLocaleString('es-CR')}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={row.errors.join('; ')}>
                        {row.errors.join('; ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                resetState();
                onOpenChange(false);
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
                className="bg-navy hover:bg-navy/90"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar {validCount} registros
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Importando datos históricos...</p>
              <p className="text-sm text-muted-foreground">
                Por favor no cierres esta ventana
              </p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              {importResults.failed === 0 ? (
                <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
              ) : (
                <AlertTriangle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">
                {importResults.failed === 0 ? 'Importación exitosa' : 'Importación completada con errores'}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResults.success}</p>
                <p className="text-sm text-green-700">Registros importados</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{importResults.failed}</p>
                <p className="text-sm text-red-700">Errores</p>
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <ScrollArea className="h-[150px] rounded-md border p-4">
                <div className="space-y-1">
                  {importResults.errors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">• {error}</p>
                  ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button onClick={() => {
                resetState();
                onOpenChange(false);
              }} className="bg-navy hover:bg-navy/90">
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
