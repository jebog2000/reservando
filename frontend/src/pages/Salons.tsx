import { useEffect, useState } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Salon {
  id: number;
  name: string;
  capacity: number;
  description: string;
  active: boolean;
}

const emptyForm = {
  name: '',
  capacity: '',
  description: '',
  active: true,
};

export default function Salons() {
  const { toast } = useToast();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadSalons = async () => {
    try {
      const response = await client.entities.salons.queryAll({
        query: {},
        limit: 50,
        skip: 0,
      });
      if (response?.data?.items) {
        setSalons(response.data.items);
      }
    } catch (err) {
      console.error('Error loading salons:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar os salões', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalons();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (salon: Salon) => {
    setEditingId(salon.id);
    setForm({
      name: salon.name,
      capacity: String(salon.capacity || ''),
      description: salon.description || '',
      active: salon.active !== false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este salão?')) return;
    try {
      await client.entities.salons.delete({ id });
      toast({ title: 'Sucesso', description: 'Salão excluído com sucesso' });
      loadSalons();
    } catch (err) {
      console.error('Error deleting salon:', err);
      toast({ title: 'Erro', description: 'Não foi possível excluir o salão', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Campo obrigatório', description: 'O nome do salão é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        capacity: form.capacity ? parseInt(form.capacity, 10) : 0,
        description: form.description.trim(),
        active: form.active,
      };

      if (editingId !== null) {
        console.log('[Salons] Updating salon, id:', editingId, 'payload:', payload);
        const updateResp = await client.entities.salons.update({ id: editingId, data: payload });
        console.log('[Salons] Update response:', updateResp);
        toast({ title: 'Sucesso', description: 'Salão atualizado com sucesso' });
      } else {
        console.log('[Salons] Creating salon, payload:', payload);
        const createResp = await client.entities.salons.create({ data: payload });
        console.log('[Salons] Create response:', createResp);
        toast({ title: 'Sucesso', description: 'Salão criado com sucesso' });
      }

      setDialogOpen(false);
      loadSalons();
    } catch (err) {
      console.error('Error saving salon:', err);
      toast({ title: 'Erro', description: 'Não foi possível salvar o salão', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Cadastro de Salões</h1>
        <Button onClick={openCreate} className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white gap-2">
          <Plus className="w-4 h-4" />
          Novo Salão
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1e3a5f]">Salões Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {salons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum salão cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salons.map((salon) => (
                  <TableRow key={salon.id}>
                    <TableCell className="font-medium">{salon.name}</TableCell>
                    <TableCell>{salon.capacity || '-'}</TableCell>
                    <TableCell>{salon.description || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        salon.active !== false
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {salon.active !== false ? 'Sim' : 'Não'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(salon)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(salon.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">
              {editingId !== null ? 'Editar Salão' : 'Novo Salão'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salon-name">Nome *</Label>
              <Input
                id="salon-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do salão"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salon-capacity">Capacidade</Label>
              <Input
                id="salon-capacity"
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="Número de lugares"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salon-description">Descrição</Label>
              <textarea
                id="salon-description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do salão"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="salon-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label htmlFor="salon-active">Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white">
                {saving ? 'Salvando...' : editingId !== null ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}