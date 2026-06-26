import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  { key: "dic", label: "Dic", monthIndex: 11 },
  { key: "ene", label: "Ene", monthIndex: 0 },
  { key: "feb", label: "Feb", monthIndex: 1 },
  { key: "mar", label: "Mar", monthIndex: 2 },
  { key: "abr", label: "Abr", monthIndex: 3 },
  { key: "may", label: "May", monthIndex: 4 },
  { key: "jun", label: "Jun", monthIndex: 5 },
  { key: "jul", label: "Jul", monthIndex: 6 },
  { key: "ago", label: "Ago", monthIndex: 7 },
  { key: "sep", label: "Set", monthIndex: 8 },
  { key: "oct", label: "Oct", monthIndex: 9 },
  { key: "nov", label: "Nov", monthIndex: 10 },
];

interface EmployeeRow {
  id: string;
  full_name: string;
  base_salary: number;
  currency: string;
  hire_date: string; // ISO yyyy-mm-dd
  months: number[]; // 12 values in USD (employee currency assumed USD)
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
const fmtCRC = (n: number) =>
  "₡" +
  new Intl.NumberFormat("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function AguinaldoReport() {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number>(2026); // "Período Dic (Y-1) – Nov Y"
  const [exchangeRate, setExchangeRate] = useState<number>(456.62);
  const [rows, setRows] = useState<EmployeeRow[]>([]);

  const periodStart = useMemo(() => new Date(Date.UTC(year - 1, 11, 1)), [year]);
  const periodEnd = useMemo(() => new Date(Date.UTC(year, 10, 30)), [year]);

  const monthDates = useMemo(
    () => MONTHS.map((m, i) => new Date(Date.UTC(i === 0 ? year - 1 : year, m.monthIndex, 1))),
    [year]
  );

  // Default hire dates by name (per spec)
  const defaultHireDate = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("laura") && n.includes("bermúdez")) return "2026-04-12";
    if (n.includes("isabela") && n.includes("araya")) return "2026-04-12";
    return `${year - 1}-12-01`;
  };

  // Default monthly base salary (USD) by name per spec
  const defaultBaseSalary = (name: string, fallback: number): number => {
    const n = name.toLowerCase();
    if (n.includes("gabriel") && n.includes("cordero")) return 5000;
    if (n.includes("isabela") && n.includes("araya")) return 1500;
    if (n.includes("laura") && n.includes("bermúdez")) return 1500;
    if (n.includes("jonathan") && n.includes("campos")) return 1800;
    if (n.includes("maría") && n.includes("solórzano")) return 1800;
    if (n.includes("marianne") && n.includes("robles")) return 1600;
    return fallback || 0;
  };

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const { data: emps, error: empErr } = await supabase
        .from("employees")
        .select("id, full_name, base_salary, currency, hire_date")
        .eq("company_id", selectedCompany.id)
        .eq("status", "activo")
        .order("full_name");
      if (empErr) throw empErr;

      // Fetch payroll lines in period
      const { data: batches } = await supabase
        .from("payroll_batches")
        .select("id, period_start, period_end")
        .eq("company_id", selectedCompany.id)
        .gte("period_start", periodStart.toISOString().slice(0, 10))
        .lte("period_end", periodEnd.toISOString().slice(0, 10));

      const batchIds = (batches || []).map((b: any) => b.id);
      let lines: any[] = [];
      if (batchIds.length > 0) {
        const { data: ll } = await supabase
          .from("payroll_lines")
          .select("employee_id, batch_id, gross_salary, currency, exchange_rate_to_base")
          .in("batch_id", batchIds);
        lines = ll || [];
      }
      const batchMap = new Map((batches || []).map((b: any) => [b.id, b]));

      // monthly aggregation per employee in USD
      const aggregate: Record<string, Record<number, number>> = {};
      for (const l of lines) {
        const b = batchMap.get(l.batch_id);
        if (!b) continue;
        const startDate = new Date(b.period_start + "T00:00:00Z");
        const monthIdx = MONTHS.findIndex(
          (m, i) =>
            startDate.getUTCMonth() === m.monthIndex &&
            startDate.getUTCFullYear() === (i === 0 ? year - 1 : year)
        );
        if (monthIdx < 0) continue;
        const gross = Number(l.gross_salary) || 0;
        const grossUSD =
          l.currency === "USD" ? gross : gross / (Number(l.exchange_rate_to_base) || exchangeRate);
        if (!aggregate[l.employee_id]) aggregate[l.employee_id] = {};
        aggregate[l.employee_id][monthIdx] = (aggregate[l.employee_id][monthIdx] || 0) + grossUSD;
      }

      const newRows: EmployeeRow[] = (emps || []).map((e: any) => {
        const hire = e.hire_date || defaultHireDate(e.full_name);
        const baseUSD = defaultBaseSalary(e.full_name, Number(e.base_salary) || 0);
        const hireDate = new Date(hire + "T00:00:00Z");
        const months = monthDates.map((md, idx) => {
          if (md < new Date(Date.UTC(hireDate.getUTCFullYear(), hireDate.getUTCMonth(), 1))) return 0;
          return aggregate[e.id]?.[idx] ?? baseUSD;
        });
        return {
          id: e.id,
          full_name: e.full_name,
          base_salary: baseUSD,
          currency: e.currency || "USD",
          hire_date: hire,
          months,
        };
      });

      setRows(newRows);
    } catch (err: any) {
      console.error(err);
      toast.error("Error cargando datos: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompany) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, year]);

  const updateCell = (rowIdx: number, monthIdx: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const r = { ...copy[rowIdx], months: [...copy[rowIdx].months] };
      r.months[monthIdx] = Number(value) || 0;
      copy[rowIdx] = r;
      return copy;
    });
  };

  const updateHire = (rowIdx: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const r = { ...copy[rowIdx], hire_date: value };
      const hireDate = new Date(value + "T00:00:00Z");
      r.months = r.months.map((v, idx) => {
        const md = monthDates[idx];
        if (md < new Date(Date.UTC(hireDate.getUTCFullYear(), hireDate.getUTCMonth(), 1))) return 0;
        return v || r.base_salary;
      });
      copy[rowIdx] = r;
      return copy;
    });
  };

  const isMonthDisabled = (row: EmployeeRow, idx: number) => {
    const hireDate = new Date(row.hire_date + "T00:00:00Z");
    return monthDates[idx] < new Date(Date.UTC(hireDate.getUTCFullYear(), hireDate.getUTCMonth(), 1));
  };

  const recalc = () => {
    setRows((prev) => [...prev]);
    toast.success("Recalculado");
  };

  const exportCSV = () => {
    const headers = [
      "Colaborador",
      "Fecha ingreso",
      ...MONTHS.map((m) => m.label),
      "Total USD",
      "Aguinaldo USD",
      "Total CRC",
      "Aguinaldo CRC",
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      const totalUSD = r.months.reduce((s, v) => s + v, 0);
      const aguinaldoUSD = totalUSD / 12;
      const totalCRC = totalUSD * exchangeRate;
      const aguinaldoCRC = totalCRC / 12;
      lines.push(
        [
          `"${r.full_name}"`,
          r.hire_date,
          ...r.months.map((v) => v.toFixed(2)),
          totalUSD.toFixed(2),
          aguinaldoUSD.toFixed(2),
          totalCRC.toFixed(2),
          aguinaldoCRC.toFixed(2),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aguinaldo_${year - 1}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    let totalUSD = 0;
    let totalCRC = 0;
    rows.forEach((r) => {
      const sumUSD = r.months.reduce((s, v) => s + v, 0);
      totalUSD += sumUSD / 12;
      totalCRC += (sumUSD * exchangeRate) / 12;
    });
    return { totalUSD, totalCRC };
  }, [rows, exchangeRate]);

  const yearOptions = [2025, 2026, 2027, 2028];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporte de Aguinaldo</h1>
        <p className="text-muted-foreground">
          Cálculo del aguinaldo según ley de Costa Rica: (salarios brutos Dic – Nov) ÷ 12
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Período de aguinaldo</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    Dic {y - 1} – Nov {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de cambio (USD → CRC)</Label>
            <Input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
              className="w-[180px]"
            />
          </div>
          <Button onClick={recalc} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recalcular
          </Button>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={load} variant="ghost">
            Recargar datos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No hay colaboradores activos.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px] sticky left-0 bg-background">Colaborador</TableHead>
                    <TableHead className="min-w-[140px]">Fecha ingreso</TableHead>
                    {MONTHS.map((m) => (
                      <TableHead key={m.key} className="text-right min-w-[90px]">
                        {m.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[140px]">Total</TableHead>
                    <TableHead className="text-right min-w-[160px]">Aguinaldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, rIdx) => {
                    const sumUSD = r.months.reduce((s, v) => s + v, 0);
                    const aguinaldoUSD = sumUSD / 12;
                    const sumCRC = sumUSD * exchangeRate;
                    const aguinaldoCRC = sumCRC / 12;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          {r.full_name}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.hire_date}
                            onChange={(e) => updateHire(rIdx, e.target.value)}
                            className="h-8 w-[140px]"
                          />
                        </TableCell>
                        {r.months.map((v, mIdx) => {
                          const disabled = isMonthDisabled(r, mIdx);
                          return (
                            <TableCell key={mIdx} className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={disabled ? 0 : v}
                                disabled={disabled}
                                onChange={(e) => updateCell(rIdx, mIdx, e.target.value)}
                                className={`h-8 w-[90px] text-right ${disabled ? "bg-muted text-muted-foreground" : ""}`}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right text-xs">
                          <div>{fmtUSD(sumUSD)}</div>
                          <div className="text-muted-foreground">{fmtCRC(sumCRC)}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs">
                          <div>{fmtUSD(aguinaldoUSD)}</div>
                          <div className="text-muted-foreground">{fmtCRC(aguinaldoCRC)}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="sticky left-0 bg-muted/50" colSpan={2}>
                      TOTAL
                    </TableCell>
                    <TableCell colSpan={12}></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-xs">
                      <div>{fmtUSD(totals.totalUSD)}</div>
                      <div className="text-muted-foreground">{fmtCRC(totals.totalCRC)}</div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
