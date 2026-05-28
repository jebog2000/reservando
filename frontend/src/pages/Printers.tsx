import { useEffect, useState } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Printer, Star } from 'lucide-react';
import { toast } from 'sonner';

interface PrinterSetting {
  id: number;
  printer_type: string;
  printer_name: string;
  printnode_api_key?: string;
  printnode_printer_id?: string;
  paper_width?: number;
  is_default?: boolean;
}

const emptyForm = {
  printer_name: '',
  printer_type: 'local',
  printnode_api_key: '',
  printnode_printer_id: '',
  paper_width: 80,
  is_default: false,
};

export default function Printers() {
  const [printers, setPrinters] = useState<PrinterSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPrinters = async () => {
    try {
      const response = await client.entities.printer_settings.query({});
      setPrinters(response.data?.items || []);
    } catch {
      toast.error('Erro ao carregar impressoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (printer: PrinterSetting) => {
    setEditingId(printer.id);
    setForm({
      printer_name: printer.printer_name,
      printer_type: printer.printer_type,
      printnode_api_key: printer.printnode_api_key || '',
      printnode_printer_id: printer.printnode_printer_id || '',
      paper_width: printer.paper_width || 80,
      is_default: printer.is_default || false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.printer_name.trim()) {
      toast.error('Nome da impressora é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        printer_name: form.printer_name.trim(),
        printer_type: form.printer_type,
        printnode_api_key: form.printer_type === 'printnode' ? form.printnode_api_key : '',
        printnode_printer_id: form.printer_type === 'printnode' ? form.printnode_printer_id : '',
        paper_width: form.paper_width,
        is_default: form.is_default,
      };

      if (editingId) {
        await client.entities.printer_settings.update({
          id: String(editingId),
          data: payload,
        });
        toast.success('Impressora atualizada');
      } else {
        await client.entities.printer_settings.create({
          data: payload,
        });
        toast.success('Impressora adicionada');
      }
      setDialogOpen(false);
      fetchPrinters();
    } catch {
      toast.error('Erro ao salvar impressora');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta impressora?')) return;
    try {
      await client.entities.printer_settings.delete({ id: String(id) });
      toast.success('Impressora excluída');
      fetchPrinters();
    } catch {
      toast.error('Erro ao excluir impressora');
    }
  };

  const handleSetDefault = async (printer: PrinterSetting) => {
    try {
      // Unset current defaults
      for (const p of printers) {
        if (p.is_default && p.id !== printer.id) {
          await client.entities.printer_settings.update({
            id: String(p.id),
            data: { is_default: false },
          });
        }
      }
      // Set new default
      await client.entities.printer_settings.update({
        id: String(printer.id),
        data: { is_default: true },
      });
      toast.success(`"${printer.printer_name}" definida como padrão`);
      fetchPrinters();
    } catch {
      toast.error('Erro ao definir impressora padrão');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Impressoras</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure suas impressoras para impressão de reservas
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar
        </Button>
      </div>

      {printers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">
              Nenhuma impressora configurada.
              <br />
              Adicione uma impressora para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {printers.map((printer) => (
            <Card key={printer.id} className={printer.is_default ? 'border-[#f59e0b] border-2' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Printer className="w-5 h-5 text-[#1e3a5f]" />
                    {printer.printer_name}
                  </CardTitle>
                  {printer.is_default && (
                    <span className="text-xs bg-[#f59e0b] text-white px-2 py-1 rounded-full font-medium">
                      Padrão
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p>
                    <span className="font-medium">Tipo:</span>{' '}
                    {printer.printer_type === 'local' ? 'Local' : 'PrintNode'}
                  </p>
                  <p>
                    <span className="font-medium">Largura do papel:</span>{' '}
                    {printer.paper_width || 80}mm
                  </p>
                  {printer.printer_type === 'printnode' && printer.printnode_printer_id && (
                    <p>
                      <span className="font-medium">Printer ID:</span>{' '}
                      {printer.printnode_printer_id}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!printer.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(printer)}
                      className="text-[#f59e0b] border-[#f59e0b] hover:bg-[#f59e0b]/10"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Padrão
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(printer)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(printer.id)}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Impressora' : 'Adicionar Impressora'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="printer_name">Nome da Impressora *</Label>
              <Input
                id="printer_name"
                value={form.printer_name}
                onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
                placeholder="Ex: Impressora Térmica Cozinha"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="printer_type">Tipo</Label>
              <Select
                value={form.printer_type}
                onValueChange={(value) => setForm({ ...form, printer_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (Navegador)</SelectItem>
                  <SelectItem value="printnode">PrintNode (Remota)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.printer_type === 'printnode' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="printnode_api_key">API Key do PrintNode</Label>
                  <Input
                    id="printnode_api_key"
                    type="password"
                    value={form.printnode_api_key}
                    onChange={(e) => setForm({ ...form, printnode_api_key: e.target.value })}
                    placeholder="Sua chave de API do PrintNode"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="printnode_printer_id">ID da Impressora (PrintNode)</Label>
                  <Input
                    id="printnode_printer_id"
                    value={form.printnode_printer_id}
                    onChange={(e) => setForm({ ...form, printnode_printer_id: e.target.value })}
                    placeholder="ID numérico da impressora"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="paper_width">Largura do Papel (mm)</Label>
              <Input
                id="paper_width"
                type="number"
                value={form.paper_width}
                onChange={(e) => setForm({ ...form, paper_width: parseInt(e.target.value) || 80 })}
                min={40}
                max={120}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_default">Impressora padrão</Label>
              <Switch
                id="is_default"
                checked={form.is_default}
                onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}