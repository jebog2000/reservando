import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Edit, XCircle, Plus } from 'lucide-react';

interface Reservation {
  id: number;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  salon: string;
  notes?: string;
  status: string;
  preference?: string;
  calendar_event_id?: string;
}

const STATUSES = ['confirmada', 'a confirmar', 'cancelada', 'concluída'];

export default function Query() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    clientName: '',
    status: '',
  });

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = {};
      if (filters.dateFrom) query.reservation_date__gte = filters.dateFrom;
      if (filters.dateTo) query.reservation_date__lte = filters.dateTo;
      if (filters.status) query.status = filters.status;
      if (filters.clientName) query.client_name__contains = filters.clientName;

      const response = await client.entities.reservations.queryAll({
        query,
        sort: '-reservation_date',
        limit: 100,
      });
      setReservations(response?.data?.items || []);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchReservations();
  };

  const handleCancel = async (id: number) => {
    try {
      const reservation = reservations.find((r) => r.id === id);

      await client.entities.reservations.update({
        id: String(id),
        data: { status: 'cancelada' },
      });

      if (reservation?.calendar_event_id) {
        try {
          await client.apiCall.invoke({
            url: '/api/v1/google-calendar/cancel-event',
            method: 'POST',
            data: { event_id: reservation.calendar_event_id },
          });
        } catch (calendarErr) {
          console.error('Error cancelling calendar event:', calendarErr);
          // Não bloqueia o cancelamento da reserva se o Google Calendar falhar
        }
      }

      toast({ title: 'Reserva cancelada' });
      fetchReservations();
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      toast({ title: 'Erro', description: 'Não foi possível cancelar a reserva', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      confirmada: 'bg-green-100 text-green-700',
      'a confirmar': 'bg-amber-100 text-amber-700',
      cancelada: 'bg-red-100 text-red-700',
      concluída: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Consultar Reservas</h1>
        <Button
          onClick={() => navigate('/reservas')}
          className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Reserva
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Input
                value={filters.clientName}
                onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(val) => setFilters({ ...filters, status: val === 'all' ? '' : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} className="bg-[#f59e0b] hover:bg-[#d97706] text-white gap-2">
              <Search className="w-4 h-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma reserva encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pessoas</TableHead>
                  <TableHead>Salão</TableHead>
                  <TableHead>Preferência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.reservation_date
                        ? format(new Date(r.reservation_date + 'T12:00:00'), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{r.reservation_time || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.client_name}</p>
                        {r.client_phone && (
                          <p className="text-xs text-gray-500">{r.client_phone}</p>
                        )}
                        {r.client_email && (
                          <p className="text-xs text-gray-400">{r.client_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.party_size}</TableCell>
                    <TableCell>{r.salon}</TableCell>
                    <TableCell>{r.preference || '-'}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/reservas?id=${r.id}`)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4 text-[#1e3a5f]" />
                        </Button>
                        {r.status !== 'cancelada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(r.id)}
                            title="Cancelar"
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}