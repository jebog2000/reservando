import { useEffect, useState, useCallback } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, UserPlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClientData {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes: string;
  created_at?: string;
}

interface ReservationData {
  id: number;
  client_name: string;
  client_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  salon: string;
  status: string;
  preference: string;
  notes: string;
}

export default function Clients() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reservations, setReservations] = useState<Record<number, ReservationData[]>>({});
  const [loadingReservations, setLoadingReservations] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = {};
      if (searchTerm.trim()) {
        // Search by name or phone using contains
        query.name__contains = searchTerm.trim();
      }
      const response = await client.entities.clients.queryAll({
        query,
        sort: 'name',
        limit: 100,
        skip: 0,
      });
      const items = response?.data?.items || [];

      // If searching, also search by phone and merge results
      if (searchTerm.trim()) {
        const phoneResponse = await client.entities.clients.queryAll({
          query: { phone__contains: searchTerm.trim() },
          sort: 'name',
          limit: 100,
          skip: 0,
        });
        const phoneItems = phoneResponse?.data?.items || [];
        const existingIds = new Set(items.map((c: ClientData) => c.id));
        for (const item of phoneItems) {
          if (!existingIds.has(item.id)) {
            items.push(item);
          }
        }
      }

      setClients(items);
    } catch (err) {
      console.error('Error loading clients:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar os clientes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, toast]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const toggleExpand = async (clientItem: ClientData) => {
    if (expandedId === clientItem.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(clientItem.id);

    if (!reservations[clientItem.id]) {
      setLoadingReservations(clientItem.id);
      try {
        const response = await client.entities.reservations.queryAll({
          query: { client_phone: clientItem.phone },
          sort: '-reservation_date',
          limit: 50,
          skip: 0,
        });
        setReservations((prev) => ({
          ...prev,
          [clientItem.id]: response?.data?.items || [],
        }));
      } catch (err) {
        console.error('Error loading reservations:', err);
      } finally {
        setLoadingReservations(null);
      }
    }
  };

  const startEdit = (clientItem: ClientData) => {
    setEditingId(clientItem.id);
    setEditForm({ name: clientItem.name, phone: clientItem.phone, email: clientItem.email || '', notes: clientItem.notes || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', phone: '', email: '', notes: '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast({ title: 'Erro', description: 'Nome e telefone são obrigatórios', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      await client.apiCall.invoke({
        url: `/api/v1/entities/clients/all/${editingId}`,
        method: 'PUT',
        data: { name: editForm.name.trim(), phone: editForm.phone.trim(), email: editForm.email.trim(), notes: editForm.notes.trim() },
      });
      toast({ title: 'Sucesso', description: 'Cliente atualizado' });
      setEditingId(null);
      loadClients();
    } catch (err) {
      console.error('Error updating client:', err);
      toast({ title: 'Erro', description: 'Não foi possível atualizar o cliente', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await client.apiCall.invoke({
        url: `/api/v1/entities/clients/all/${deleteId}`,
        method: 'DELETE',
        data: {},
      });
      toast({ title: 'Sucesso', description: 'Cliente removido' });
      setDeleteId(null);
      loadClients();
    } catch (err) {
      console.error('Error deleting client:', err);
      toast({ title: 'Erro', description: 'Não foi possível remover o cliente', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada': return 'text-green-600';
      case 'a confirmar': return 'text-amber-600';
      case 'cancelada': return 'text-red-600';
      case 'concluída': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Clientes</h1>
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#1e3a5f]" />
          <span className="text-sm text-gray-500">{clients.length} cadastrados</span>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {searchTerm ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado ainda.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((clientItem) => (
            <Card key={clientItem.id} className="overflow-hidden">
              <CardContent className="p-0">
                {editingId === clientItem.id ? (
                  /* Edit Mode */
                  <div className="p-4 space-y-3 bg-blue-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Nome"
                      />
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Telefone"
                      />
                    </div>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email"
                      type="email"
                    />
                    <Input
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Observações"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={savingEdit}
                        className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
                      >
                        <Save className="w-4 h-4 mr-1" /> {savingEdit ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    <div className="flex items-center p-4 gap-3">
                      <button
                        onClick={() => toggleExpand(clientItem)}
                        className="flex-shrink-0 text-gray-400 hover:text-[#1e3a5f]"
                      >
                        {expandedId === clientItem.id ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-[#1e3a5f]">{clientItem.name}</span>
                          <span className="text-sm text-gray-500">{clientItem.phone}</span>
                          {clientItem.email && (
                            <span className="text-sm text-gray-400">{clientItem.email}</span>
                          )}
                        </div>
                        {clientItem.notes && (
                          <p className="text-sm text-gray-400 mt-1 truncate">{clientItem.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(clientItem)}>
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(clientItem.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Reservation History */}
                    {expandedId === clientItem.id && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-[#1e3a5f] mb-3">Histórico de Reservas</h4>
                        {loadingReservations === clientItem.id ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1e3a5f]"></div>
                          </div>
                        ) : (reservations[clientItem.id] || []).length === 0 ? (
                          <p className="text-sm text-gray-400">Nenhuma reserva encontrada.</p>
                        ) : (
                          <div className="space-y-2">
                            {(reservations[clientItem.id] || []).map((res) => (
                              <div
                                key={res.id}
                                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border"
                              >
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="font-medium">{res.reservation_date}</span>
                                  <span className="text-gray-500">{res.reservation_time}</span>
                                  <span className="text-gray-500">{res.party_size}p</span>
                                  <span className="text-gray-500">{res.salon}</span>
                                  {res.preference && (
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{res.preference}</span>
                                  )}
                                </div>
                                <span className={`font-medium text-xs ${getStatusColor(res.status)}`}>
                                  {res.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}