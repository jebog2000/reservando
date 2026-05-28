import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, ArrowLeft } from 'lucide-react';

interface SalonOption {
  id: number;
  name: string;
  active: boolean;
}

interface ClientSuggestion {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes: string;
}

const STATUSES = ['confirmada', 'a confirmar', 'cancelada', 'concluída'];
const PREFERENCES = ['Rodízio', 'A la carte', 'A escolher'];

export default function Reservations() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    reservation_date: '',
    reservation_time: '',
    party_size: '',
    salon: '',
    notes: '',
    status: 'a confirmar',
    preference: '',
  });

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSalons();
  }, []);

  useEffect(() => {
    if (editId) {
      loadReservation(editId);
    }
  }, [editId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) {
        setShowNameSuggestions(false);
      }
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) {
        setShowPhoneSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchClients = useCallback(async (term: string, field: 'name' | 'phone') => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const query: Record<string, string> = {};
      if (field === 'name') {
        query.name__contains = term;
      } else {
        query.phone__contains = term;
      }
      const response = await client.entities.clients.queryAll({
        query,
        sort: 'name',
        limit: 10,
        skip: 0,
      });
      setSuggestions(response?.data?.items || []);
    } catch (err) {
      console.error('Error searching clients:', err);
      setSuggestions([]);
    }
  }, []);

  const handleNameChange = (value: string) => {
    setForm({ ...form, client_name: value });
    setShowNameSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value, 'name'), 300);
  };

  const handlePhoneChange = (value: string) => {
    setForm({ ...form, client_phone: value });
    setShowPhoneSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value, 'phone'), 300);
  };

  const selectSuggestion = (suggestion: ClientSuggestion) => {
    setForm({
      ...form,
      client_name: suggestion.name,
      client_phone: suggestion.phone,
      client_email: suggestion.email || '',
    });
    setSuggestions([]);
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const loadSalons = async () => {
    try {
      const response = await client.entities.salons.queryAll({
        query: {},
        limit: 50,
        skip: 0,
      });
      if (response?.data?.items) {
        setSalons(response.data.items.filter((s: SalonOption) => s.active !== false));
      }
    } catch (err) {
      console.error('Error loading salons:', err);
    } finally {
      setSalonsLoading(false);
    }
  };

  const loadReservation = async (id: string) => {
    setLoading(true);
    try {
      const response = await client.apiCall.invoke({
        url: `/api/v1/entities/reservations/all/${id}`,
        method: 'GET',
        data: {},
      });
      if (response?.data) {
        const r = response.data;
        setForm({
          client_name: r.client_name || '',
          client_phone: r.client_phone || '',
          client_email: r.client_email || '',
          reservation_date: r.reservation_date || '',
          reservation_time: r.reservation_time || '',
          party_size: String(r.party_size || ''),
          salon: r.salon || '',
          notes: r.notes || '',
          status: r.status || 'confirmada',
          preference: r.preference || '',
        });
        setCalendarEventId(r.calendar_event_id || null);
      }
    } catch (err) {
      console.error('Error loading reservation:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar a reserva', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const upsertClient = async (name: string, phone: string, email: string) => {
    if (!phone.trim()) return;
    try {
      // Check if client exists by phone
      const response = await client.entities.clients.queryAll({
        query: { phone: phone.trim() },
        limit: 1,
        skip: 0,
      });
      const existing = response?.data?.items?.[0];
      if (existing) {
        // Update name/email if changed
        const updates: Record<string, string> = {
          name: name.trim() || existing.name,
          phone: phone.trim(),
          notes: existing.notes || '',
        };
        if (email.trim()) {
          updates.email = email.trim();
        }
        if (existing.name !== name.trim() || (email.trim() && existing.email !== email.trim())) {
          await client.apiCall.invoke({
            url: `/api/v1/entities/clients/all/${existing.id}`,
            method: 'PUT',
            data: updates,
          });
        }
      } else {
        // Create new client
        const newClientData: Record<string, string> = { name: name.trim(), phone: phone.trim(), notes: '' };
        if (email.trim()) {
          newClientData.email = email.trim();
        }
        await client.entities.clients.create({
          data: newClientData,
        });
      }
    } catch (err) {
      console.error('Error upserting client:', err);
    }
  };

  const syncCalendarEvent = async (reservationId: string | number, eventId: string | null) => {
    try {
      const summary = `Reserva - ${form.client_name}`;
      const descriptionParts = [
        `Pessoas: ${form.party_size}`,
        `Salão: ${form.salon}`,
      ];
      if (form.preference) descriptionParts.push(`Preferência: ${form.preference}`);
      if (form.notes) descriptionParts.push(`Obs: ${form.notes}`);
      const description = descriptionParts.join('\n');

      const startDatetime = `${form.reservation_date}T${form.reservation_time}:00`;
      // Calculate end time (+ 2 hours)
      const startDate = new Date(`${form.reservation_date}T${form.reservation_time}:00`);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      const endHours = String(endDate.getHours()).padStart(2, '0');
      const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      const endDatetime = `${endDateStr}T${endHours}:${endMinutes}:00`;

      if (eventId) {
        // Update existing event
        await client.apiCall.invoke({
          url: '/api/v1/google-calendar/update-event',
          method: 'PUT',
          data: {
            event_id: eventId,
            summary,
            description,
            start_datetime: startDatetime,
            end_datetime: endDatetime,
            attendee_email: form.client_email || undefined,
            location: form.salon,
          },
        });
      } else {
        // Create new event
        const calResponse = await client.apiCall.invoke({
          url: '/api/v1/google-calendar/create-event',
          method: 'POST',
          data: {
            summary,
            description,
            start_datetime: startDatetime,
            end_datetime: endDatetime,
            attendee_email: form.client_email || undefined,
            location: form.salon,
          },
        });
        // Save calendar_event_id to reservation
        const newEventId = calResponse?.data?.event_id || calResponse?.data?.id;
        if (newEventId) {
          await client.apiCall.invoke({
            url: `/api/v1/entities/reservations/all/${reservationId}`,
            method: 'PUT',
            data: { calendar_event_id: newEventId },
          });
          setCalendarEventId(newEventId);
        }
      }
    } catch (err) {
      console.error('Error syncing calendar event:', err);
      // Don't block reservation save on calendar errors
    }
  };

  const cancelCalendarEvent = async (eventId: string) => {
    try {
      await client.apiCall.invoke({
        url: '/api/v1/google-calendar/cancel-event',
        method: 'POST',
        data: { event_id: eventId },
      });
    } catch (err) {
      console.error('Error cancelling calendar event:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name || !form.reservation_date || !form.reservation_time || !form.party_size || !form.salon) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_email: form.client_email,
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        party_size: parseInt(form.party_size, 10),
        salon: form.salon,
        notes: form.notes,
        status: form.status,
        preference: form.preference,
      };

      let savedId: string | number = '';

      if (editId) {
        await client.apiCall.invoke({
          url: `/api/v1/entities/reservations/all/${editId}`,
          method: 'PUT',
          data: payload,
        });
        savedId = editId;
        toast({ title: 'Sucesso', description: 'Reserva atualizada com sucesso' });

        // Handle calendar sync
        if (form.status === 'cancelada' && calendarEventId) {
          await cancelCalendarEvent(calendarEventId);
        } else if (form.status !== 'cancelada') {
          await syncCalendarEvent(editId, calendarEventId);
        }
      } else {
        const createResponse = await client.entities.reservations.create({ data: payload });
        savedId = createResponse?.data?.id || '';
        toast({ title: 'Sucesso', description: 'Reserva criada com sucesso' });

        // Create calendar event for new reservation
        if (savedId && form.status !== 'cancelada') {
          await syncCalendarEvent(savedId, null);
        }
      }

      // Upsert client after saving reservation
      await upsertClient(form.client_name, form.client_phone, form.client_email);

      navigate('/consultar');
    } catch (err) {
      console.error('Error saving reservation:', err);
      toast({ title: 'Erro', description: 'Não foi possível salvar a reserva', variant: 'destructive' });
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">
          {editId ? 'Editar Reserva' : 'Nova Reserva'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1e3a5f]">Dados da Reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 relative" ref={nameRef}>
                <Label htmlFor="client_name">Nome do Cliente *</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowNameSuggestions(true); }}
                  placeholder="Nome completo"
                  autoComplete="off"
                />
                {showNameSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-[#1e3a5f]">{s.name}</span>
                        <span className="text-gray-400">{s.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 relative" ref={phoneRef}>
                <Label htmlFor="client_phone">Telefone</Label>
                <Input
                  id="client_phone"
                  value={form.client_phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowPhoneSuggestions(true); }}
                  placeholder="(00) 00000-0000"
                  autoComplete="off"
                />
                {showPhoneSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-400">{s.name}</span>
                        <span className="font-medium text-[#1e3a5f]">{s.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_email">Email do Cliente</Label>
              <Input
                id="client_email"
                type="email"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reservation_date">Data *</Label>
                <Input
                  id="reservation_date"
                  type="date"
                  value={form.reservation_date}
                  onChange={(e) => setForm({ ...form, reservation_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation_time">Horário *</Label>
                <Input
                  id="reservation_time"
                  type="time"
                  value={form.reservation_time}
                  onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party_size">Pessoas *</Label>
                <Input
                  id="party_size"
                  type="number"
                  min="1"
                  value={form.party_size}
                  onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                  placeholder="Nº de pessoas"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Salão *</Label>
                {salonsLoading ? (
                  <div className="h-10 flex items-center text-sm text-gray-500">Carregando salões...</div>
                ) : salons.length === 0 ? (
                  <div className="text-sm text-amber-600">
                    Nenhum salão cadastrado.{' '}
                    <Link to="/saloes" className="underline font-medium text-[#1e3a5f] hover:text-[#2d5a8e]">
                      Cadastre salões primeiro.
                    </Link>
                  </div>
                ) : (
                  <Select value={form.salon} onValueChange={(val) => setForm({ ...form, salon: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o salão" />
                    </SelectTrigger>
                    <SelectContent>
                      {salons.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preferência</Label>
                <Select value={form.preference} onValueChange={(val) => setForm({ ...form, preference: val === 'none' ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {PREFERENCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Alergias, preferências, aniversário..."
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar Reserva'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}