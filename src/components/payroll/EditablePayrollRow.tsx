import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, X, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface EditablePayrollRowProps {
  line: any;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (lineId: string, updates: any) => Promise<void>;
  onCancel: () => void;
  isValid?: boolean;
}

export function EditablePayrollRow({ 
  line, 
  isEditing, 
  onStartEdit, 
  onSave, 
  onCancel,
  isValid = true
}: EditablePayrollRowProps) {
  const [regularHours, setRegularHours] = useState(line.regular_hours || 0);
  const [overtimeHours, setOvertimeHours] = useState(line.overtime_hours || 0);
  const [absenceDays, setAbsenceDays] = useState(line.absence_days || 0);
  const [vacationDays, setVacationDays] = useState(line.vacation_days_taken || 0);
  const [sickLeaveDays, setSickLeaveDays] = useState(line.sick_leave_days || 0);
  const [additionalBonuses, setAdditionalBonuses] = useState(line.additional_bonuses || 0);
  const [additionalDeductions, setAdditionalDeductions] = useState(line.additional_deductions || 0);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate expected net for tooltip
  const grossSalary = Number(line.gross_salary) || 0;
  const deductions = Number(line.deductions) || 0;
  const netPay = Number(line.net_pay) || 0;
  const expectedNetPay = grossSalary - deductions;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(line.id, {
        regular_hours: Number(regularHours),
        overtime_hours: Number(overtimeHours),
        absence_days: Number(absenceDays),
        vacation_days_taken: Number(vacationDays),
        sick_leave_days: Number(sickLeaveDays),
        additional_bonuses: Number(additionalBonuses),
        additional_deductions: Number(additionalDeductions),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <TableRow 
        className={`cursor-pointer hover:bg-muted/50 ${!isValid ? 'bg-destructive/5' : ''}`}
        onClick={onStartEdit}
      >
        <TableCell>
          {isValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <div className="relative group">
              <AlertCircle className="h-4 w-4 text-destructive cursor-help" />
              <div className="absolute left-6 top-0 z-50 hidden group-hover:block bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border w-48">
                <p className="font-semibold text-destructive">Error de cálculo</p>
                <p>Esperado: {formatCurrency(expectedNetPay, line.currency)}</p>
                <p>Actual: {formatCurrency(netPay, line.currency)}</p>
              </div>
            </div>
          )}
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium">{line.employee.full_name}</div>
            <div className="text-sm text-muted-foreground">
              {line.employee.employee_id}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          <div>H.Reg: {regularHours}</div>
          <div className="text-muted-foreground">H.Extra: {overtimeHours}</div>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          <div>Aus: {absenceDays}</div>
          <div className="text-muted-foreground">Vac: {vacationDays}</div>
          <div className="text-muted-foreground">Inc: {sickLeaveDays}</div>
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(Number(line.gross_salary), line.currency)}
        </TableCell>
        <TableCell className="text-right font-mono text-destructive">
          {formatCurrency(Number(line.deductions), 'CRC')}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold text-green-600">
          {formatCurrency(Number(line.net_pay), 'CRC')}
        </TableCell>
        <TableCell className="text-right font-mono text-primary">
          {formatCurrency(Number(line.employer_contrib), 'CRC')}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-accent/50">
      <TableCell>
        {isValid ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{line.employee.full_name}</div>
          <div className="text-sm text-muted-foreground">
            {line.employee.employee_id}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Input
            type="number"
            step="0.5"
            value={regularHours}
            onChange={(e) => setRegularHours(e.target.value)}
            placeholder="H.Reg"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="0.5"
            value={overtimeHours}
            onChange={(e) => setOvertimeHours(e.target.value)}
            placeholder="H.Extra"
            className="h-8 text-xs"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Input
            type="number"
            step="0.5"
            value={absenceDays}
            onChange={(e) => setAbsenceDays(e.target.value)}
            placeholder="Ausencias"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="0.5"
            value={vacationDays}
            onChange={(e) => setVacationDays(e.target.value)}
            placeholder="Vacaciones"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="0.5"
            value={sickLeaveDays}
            onChange={(e) => setSickLeaveDays(e.target.value)}
            placeholder="Incapacidad"
            className="h-8 text-xs"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Input
            type="number"
            step="1000"
            value={additionalBonuses}
            onChange={(e) => setAdditionalBonuses(e.target.value)}
            placeholder="Bonos"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="1000"
            value={additionalDeductions}
            onChange={(e) => setAdditionalDeductions(e.target.value)}
            placeholder="Deducciones"
            className="h-8 text-xs"
          />
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-destructive">
        {formatCurrency(Number(line.deductions), line.currency)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold text-green-600">
        {formatCurrency(Number(line.net_pay), line.currency)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            className="h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}