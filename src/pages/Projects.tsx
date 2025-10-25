import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string;
  project_id: string;
  name: string;
  internal_code: string | null;
  hourly_rate: number | null;
  currency: string;
  status: string;
  company_id: string;
}

interface Company {
  id: string;
  display_name: string;
  base_currency: string;
}

export default function Projects() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    internal_code: '',
    hourly_rate: '',
    currency: 'CRC',
    company_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, display_name, base_currency')
        .order('display_name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('projects').insert([{
        project_id: formData.project_id,
        company_id: formData.company_id,
        name: formData.name,
        internal_code: formData.internal_code || null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        currency: formData.currency as 'CRC' | 'USD' | 'EUR' | 'GBP',
        status: 'activo' as 'activo' | 'cerrado',
      }]);

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "Proyecto creado correctamente",
      });

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el proyecto",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      name: '',
      internal_code: '',
      hourly_rate: '',
      currency: 'CRC',
      company_id: '',
    });
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.display_name || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Proyectos</h1>
          <p className="text-muted-foreground">Gestión de proyectos y tracking de horas</p>
        </div>

        {(role === 'admin' || role === 'company_manager') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Proyecto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Proyecto</DialogTitle>
                <DialogDescription>
                  Complete la información del nuevo proyecto
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_id">ID Proyecto *</Label>
                    <Input
                      id="project_id"
                      value={formData.project_id}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      placeholder="PROJ-001"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="internal_code">Código Interno</Label>
                    <Input
                      id="internal_code"
                      value={formData.internal_code}
                      onChange={(e) => setFormData({ ...formData, internal_code: e.target.value })}
                      placeholder="INT-2025"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_id">Empresa *</Label>
                  <Select
                    value={formData.company_id}
                    onValueChange={(value) => {
                      const company = companies.find(c => c.id === value);
                      setFormData({ 
                        ...formData, 
                        company_id: value,
                        currency: company?.base_currency || 'CRC'
                      });
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Proyecto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Desarrollo de Sistema"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">Tarifa por Hora</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda *</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRC">CRC - Colones</SelectItem>
                        <SelectItem value="USD">USD - Dólares</SelectItem>
                        <SelectItem value="EUR">EUR - Euros</SelectItem>
                        <SelectItem value="GBP">GBP - Libras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Proyecto'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Projects Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-primary">Lista de Proyectos</CardTitle>
          <CardDescription>
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código Interno</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tarifa/Hora</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      <FolderKanban className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      No hay proyectos registrados. Agregue el primer proyecto usando el botón "Nuevo Proyecto".
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-mono text-xs">{project.project_id}</TableCell>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {project.internal_code || '-'}
                      </TableCell>
                      <TableCell>{getCompanyName(project.company_id)}</TableCell>
                      <TableCell>
                        {project.hourly_rate 
                          ? formatCurrency(project.hourly_rate, project.currency)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{project.currency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.status === 'activo' ? 'default' : 'secondary'}>
                          {project.status === 'activo' ? 'Activo' : 'Cerrado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
