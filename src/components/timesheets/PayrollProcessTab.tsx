import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus,
  Receipt,
  FileText,
  Building2,
  Calculator,
  Save,
  Edit
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PayrollEntry {
  id: string;
  date: string;
  description: string;
  ins: number;
  ccss: number;
  accounting_entry: string;
  total_amount: number;
  status: 'pending' | 'processed' | 'completed';
}

export function PayrollProcessTab() {
  const [entries, setEntries] = useState<PayrollEntry[]>([
    {
      id: '1',
      date: '2025-09-14',
      description: 'Proceso de planilla quincenal',
      ins: 125000,
      ccss: 95000,
      accounting_entry: 'Asiento contable - Planilla septiembre Q1',
      total_amount: 6514234,
      status: 'processed'
    },
    {
      id: '2', 
      date: '2025-09-13',
      description: 'Proceso de planilla semanal',
      ins: 89000,
      ccss: 67000,
      accounting_entry: 'Asiento contable - Planilla septiembre S2',
      total_amount: 4250000,
      status: 'pending'
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<PayrollEntry>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    ins: 0,
    ccss: 0,
    accounting_entry: '',
    total_amount: 0,
    status: 'pending'
  });

  const handleSaveEntry = () => {
    if (newEntry.description && newEntry.accounting_entry) {
      const entry: PayrollEntry = {
        id: Date.now().toString(),
        date: newEntry.date || new Date().toISOString().split('T')[0],
        description: newEntry.description,
        ins: newEntry.ins || 0,
        ccss: newEntry.ccss || 0,
        accounting_entry: newEntry.accounting_entry,
        total_amount: newEntry.total_amount || 0,
        status: newEntry.status as PayrollEntry['status'] || 'pending'
      };
      setEntries([...entries, entry]);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        description: '',
        ins: 0,
        ccss: 0,
        accounting_entry: '',
        total_amount: 0,
        status: 'pending'
      });
      setIsDialogOpen(false);
    }
  };

  const getStatusBadge = (status: PayrollEntry['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completado</Badge>;
      case 'processed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Procesado</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gradient">Proceso de Planilla Diario</h2>
          <p className="text-muted-foreground">Gestión de asientos contables, INS y CCSS</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-navy text-white">
              <Plus className="h-4 w-4" />
              Nuevo Proceso
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Agregar Proceso de Planilla</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  placeholder="Descripción del proceso de planilla"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ins">INS (₡)</Label>
                  <Input
                    id="ins"
                    type="number"
                    placeholder="0"
                    value={newEntry.ins || ''}
                    onChange={(e) => setNewEntry({...newEntry, ins: Number(e.target.value)})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ccss">CCSS (₡)</Label>
                  <Input
                    id="ccss"
                    type="number"
                    placeholder="0"
                    value={newEntry.ccss || ''}
                    onChange={(e) => setNewEntry({...newEntry, ccss: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="total">Monto Total (₡)</Label>
                <Input
                  id="total"
                  type="number"
                  placeholder="0"
                  value={newEntry.total_amount || ''}
                  onChange={(e) => setNewEntry({...newEntry, total_amount: Number(e.target.value)})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accounting">Asiento Contable</Label>
                <Textarea
                  id="accounting"
                  placeholder="Descripción del asiento contable"
                  value={newEntry.accounting_entry}
                  onChange={(e) => setNewEntry({...newEntry, accounting_entry: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEntry} className="gradient-navy text-white">
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              INS Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {formatCurrency(entries.reduce((acc, entry) => acc + entry.ins, 0))}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              CCSS Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {formatCurrency(entries.reduce((acc, entry) => acc + entry.ccss, 0))}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Total Planilla
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {formatCurrency(entries.reduce((acc, entry) => acc + entry.total_amount, 0))}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Procesos de Planilla</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold">Descripción</TableHead>
                  <TableHead className="font-semibold text-right">INS</TableHead>
                  <TableHead className="font-semibold text-right">CCSS</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold">Asiento Contable</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/25">
                    <TableCell className="font-mono">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right font-mono text-teal font-semibold">
                      {formatCurrency(entry.ins)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-teal font-semibold">
                      {formatCurrency(entry.ccss)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-navy font-bold">
                      {formatCurrency(entry.total_amount)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.accounting_entry}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(entry.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        title="Editar proceso"
                      >
                        <Edit className="h-4 w-4" />
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
  );
}