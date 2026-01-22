import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface ImportRow {
  employee_id: string;
  full_name: string;
  work_email: string;
  base_salary: number;
  hire_date: string | null;
  contract_type: string;
  currency: string;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
}

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onImportComplete: () => void;
}

const REQUIRED_COLUMNS = ['employee_id', 'full_name', 'work_email', 'base_salary'];
const OPTIONAL_COLUMNS = ['hire_date', 'contract_type', 'currency'];
const VALID_CONTRACT_TYPES = ['mensual', 'por_horas'];
const VALID_CURRENCIES = ['CRC', 'USD', 'EUR', 'GBP'];

// Column name mapping: various formats -> normalized snake_case
const COLUMN_ALIASES: Record<string, string> = {
  // employee_id variations
  'employee_id': 'employee_id',
  'employeeid': 'employee_id',
  'employee id': 'employee_id',
  'employee-id': 'employee_id',
  'emp_id': 'employee_id',
  'empid': 'employee_id',
  'emp id': 'employee_id',
  'id empleado': 'employee_id',
  'idempleado': 'employee_id',
  'id_empleado': 'employee_id',
  'codigo': 'employee_id',
  'código': 'employee_id',
  'cedula': 'employee_id',
  'cédula': 'employee_id',
  'no cedula': 'employee_id',
  'no. cedula': 'employee_id',
  'numero cedula': 'employee_id',
  'número cédula': 'employee_id',
  'num cedula': 'employee_id',
  'identificacion': 'employee_id',
  'identificación': 'employee_id',
  'id': 'employee_id',
  'no': 'employee_id',
  'no.': 'employee_id',
  'numero': 'employee_id',
  'número': 'employee_id',
  'codigo empleado': 'employee_id',
  'código empleado': 'employee_id',
  
  // full_name variations
  'full_name': 'full_name',
  'fullname': 'full_name',
  'full name': 'full_name',
  'full-name': 'full_name',
  'name': 'full_name',
  'nombre': 'full_name',
  'nombre completo': 'full_name',
  'nombre_completo': 'full_name',
  'nombrecompleto': 'full_name',
  'employee name': 'full_name',
  'employee_name': 'full_name',
  'employeename': 'full_name',
  'colaborador': 'full_name',
  'empleado': 'full_name',
  'trabajador': 'full_name',
  'funcionario': 'full_name',
  'nombre del colaborador': 'full_name',
  'nombre del empleado': 'full_name',
  'nombre empleado': 'full_name',
  'nombre funcionario': 'full_name',
  'nombres': 'full_name',
  'apellidos': 'full_name',
  'nombre y apellidos': 'full_name',
  'nombres y apellidos': 'full_name',
  
  // work_email variations
  'work_email': 'work_email',
  'workemail': 'work_email',
  'work email': 'work_email',
  'work-email': 'work_email',
  'email': 'work_email',
  'correo': 'work_email',
  'correo electronico': 'work_email',
  'correo electrónico': 'work_email',
  'correo_electronico': 'work_email',
  'email trabajo': 'work_email',
  'email_trabajo': 'work_email',
  'emailtrabajo': 'work_email',
  'e-mail': 'work_email',
  'mail': 'work_email',
  'email laboral': 'work_email',
  'correo laboral': 'work_email',
  'correo empresa': 'work_email',
  'correo corporativo': 'work_email',
  
  // base_salary variations
  'base_salary': 'base_salary',
  'basesalary': 'base_salary',
  'base salary': 'base_salary',
  'base-salary': 'base_salary',
  'salary': 'base_salary',
  'salario': 'base_salary',
  'salario base': 'base_salary',
  'salario_base': 'base_salary',
  'salariobase': 'base_salary',
  'sueldo': 'base_salary',
  'sueldo base': 'base_salary',
  'salario bruto': 'base_salary',
  'salario mensual': 'base_salary',
  'sueldo mensual': 'base_salary',
  'monto': 'base_salary',
  'monto salario': 'base_salary',
  'salario ordinario': 'base_salary',
  'ingreso base': 'base_salary',
  'ingreso': 'base_salary',
  'remuneracion': 'base_salary',
  'remuneración': 'base_salary',
  'pago base': 'base_salary',
  'total salario': 'base_salary',
  'gross salary': 'base_salary',
  'gross_salary': 'base_salary',
  
  // hire_date variations
  'hire_date': 'hire_date',
  'hiredate': 'hire_date',
  'hire date': 'hire_date',
  'hire-date': 'hire_date',
  'fecha contratacion': 'hire_date',
  'fecha contratación': 'hire_date',
  'fecha_contratacion': 'hire_date',
  'fecha de contratacion': 'hire_date',
  'fecha de contratación': 'hire_date',
  'fecha ingreso': 'hire_date',
  'fecha_ingreso': 'hire_date',
  'start date': 'hire_date',
  'start_date': 'hire_date',
  'startdate': 'hire_date',
  'fecha inicio': 'hire_date',
  'fecha de ingreso': 'hire_date',
  'fecha entrada': 'hire_date',
  'antiguedad': 'hire_date',
  'antigüedad': 'hire_date',
  
  // contract_type variations
  'contract_type': 'contract_type',
  'contracttype': 'contract_type',
  'contract type': 'contract_type',
  'contract-type': 'contract_type',
  'tipo contrato': 'contract_type',
  'tipo_contrato': 'contract_type',
  'tipocontrato': 'contract_type',
  'tipo de contrato': 'contract_type',
  'contrato': 'contract_type',
  'modalidad': 'contract_type',
  'tipo pago': 'contract_type',
  'tipo de pago': 'contract_type',
  'forma pago': 'contract_type',
  
  // currency variations
  'currency': 'currency',
  'moneda': 'currency',
  'divisa': 'currency',
  'tipo moneda': 'currency',
  'tipo_moneda': 'currency',
  'coin': 'currency',
};

// Normalize column name to snake_case and check aliases
const normalizeColumnName = (columnName: string): string => {
  // Clean and normalize the column name
  const cleaned = columnName
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents for matching
    .replace(/[_\-\s]+/g, ' ') // Normalize separators to spaces
    .trim();
  
  // Check if there's a direct alias match
  if (COLUMN_ALIASES[cleaned]) {
    return COLUMN_ALIASES[cleaned];
  }
  
  // Try matching without accents in the alias keys
  const cleanedForMatch = cleaned.replace(/\s+/g, '');
  for (const [alias, normalized] of Object.entries(COLUMN_ALIASES)) {
    const cleanAlias = alias.replace(/[_\-\s]+/g, '');
    if (cleanAlias === cleanedForMatch) {
      return normalized;
    }
  }
  
  // Fallback: convert to snake_case
  return cleaned.replace(/\s+/g, '_');
};

export function ImportEmployeesDialog({ 
  open, 
  onOpenChange, 
  companyId,
  onImportComplete 
}: ImportEmployeesDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
      await processFile(files[0]);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr || dateStr === '') return null;
    
    // Try parsing various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Try DD/MM/YYYY format
    const parts = String(dateStr).split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
    
    return null;
  };

  const validateRow = (row: Record<string, any>, rowNumber: number): ImportRow => {
    const errors: string[] = [];
    
    // Validate required fields
    const employeeId = String(row.employee_id || '').trim();
    const fullName = String(row.full_name || '').trim();
    const workEmail = String(row.work_email || '').trim();
    const baseSalaryRaw = row.base_salary;
    
    if (!employeeId) errors.push('ID Empleado es requerido');
    if (!fullName) errors.push('Nombre completo es requerido');
    if (!workEmail) errors.push('Email es requerido');
    else if (!validateEmail(workEmail)) errors.push('Email inválido');
    
    // Validate salary
    const baseSalary = parseFloat(String(baseSalaryRaw).replace(/[^0-9.-]/g, ''));
    if (isNaN(baseSalary) || baseSalary <= 0) {
      errors.push('Salario base debe ser un número positivo');
    }
    
    // Validate hire date
    const hireDate = validateDate(row.hire_date);
    if (row.hire_date && !hireDate) {
      errors.push('Fecha de contratación inválida');
    }
    
    // Validate contract type
    let contractType = String(row.contract_type || 'mensual').toLowerCase().trim();
    if (!VALID_CONTRACT_TYPES.includes(contractType)) {
      contractType = 'mensual';
    }
    
    // Validate currency
    let currency = String(row.currency || 'CRC').toUpperCase().trim();
    if (!VALID_CURRENCIES.includes(currency)) {
      currency = 'CRC';
    }
    
    return {
      employee_id: employeeId,
      full_name: fullName,
      work_email: workEmail,
      base_salary: isNaN(baseSalary) ? 0 : baseSalary,
      hire_date: hireDate,
      contract_type: contractType,
      currency: currency,
      isValid: errors.length === 0,
      errors,
      rowNumber
    };
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

      // Check for required columns using normalized names
      const firstRow = jsonData[0] as Record<string, any>;
      const originalColumns = Object.keys(firstRow);
      
      // Create mapping from original column names to normalized names
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

      // Normalize column names and validate data
      const normalizedData = jsonData.map((row: any, index) => {
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = normalizeColumnName(key);
          normalizedRow[normalizedKey] = row[key];
        });
        return validateRow(normalizedRow, index + 2); // +2 because Excel rows start at 1 and first row is header
      });

      setParsedData(normalizedData);
      setStep('preview');
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

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      try {
        const { error } = await supabase.from('employees').insert({
          employee_id: row.employee_id,
          company_id: companyId,
          full_name: row.full_name,
          work_email: row.work_email,
          base_salary: row.base_salary,
          hire_date: row.hire_date,
          contract_type: row.contract_type as 'mensual' | 'por_horas',
          currency: row.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
          status: 'activo'
        });

        if (error) {
          failed++;
          errors.push(`Fila ${row.rowNumber}: ${error.message}`);
        } else {
          success++;
        }
      } catch (err: any) {
        failed++;
        errors.push(`Fila ${row.rowNumber}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / validRows.length) * 100));
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
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetState();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Empleados desde Excel
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecciona un archivo Excel o CSV con los datos de empleados'}
            {step === 'preview' && 'Revisa los datos antes de importar'}
            {step === 'importing' && 'Importando empleados...'}
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
                  Cédula, Nombre, Email, Salario
                </code>
                <p className="font-medium mt-2 mb-2">Columnas opcionales:</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  Fecha Ingreso, Tipo Contrato (mensual/por_horas), Moneda (CRC/USD/EUR/GBP)
                </code>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4">
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
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Fila</TableHead>
                    <TableHead className="w-[80px]">Estado</TableHead>
                    <TableHead>ID Empleado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Salario</TableHead>
                    <TableHead>Contrato</TableHead>
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
                      <TableCell className="font-mono text-sm">{row.employee_id || '-'}</TableCell>
                      <TableCell>{row.full_name || '-'}</TableCell>
                      <TableCell className="text-sm">{row.work_email || '-'}</TableCell>
                      <TableCell>{row.base_salary > 0 ? row.base_salary.toLocaleString() : '-'}</TableCell>
                      <TableCell>{row.contract_type}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <span className="text-xs text-destructive">
                            {row.errors.join(', ')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetState}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
              >
                Importar {validCount} empleado{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando empleados...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              {importResults.success > 0 && (
                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="h-8 w-8" />
                  <span className="text-xl font-medium">
                    {importResults.success} empleado{importResults.success !== 1 ? 's' : ''} importado{importResults.success !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              
              {importResults.failed > 0 && (
                <div className="flex items-center justify-center gap-2 text-destructive mb-4">
                  <XCircle className="h-6 w-6" />
                  <span>
                    {importResults.failed} fila{importResults.failed !== 1 ? 's' : ''} con errores
                  </span>
                </div>
              )}
            </div>

            {importResults.errors.length > 0 && (
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-1">
                  {importResults.errors.map((error, index) => (
                    <p key={index} className="text-sm text-destructive">{error}</p>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
