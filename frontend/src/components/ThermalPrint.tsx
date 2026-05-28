import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Reservation {
  id: number;
  client_name: string;
  client_phone?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  salon: string;
  notes?: string;
  status: string;
  preference?: string;
}

interface ThermalPrintProps {
  reservations: Reservation[];
  date: Date;
}

export default function ThermalPrint({ reservations, date }: ThermalPrintProps) {
  const confirmed = reservations.filter((r) => r.status !== 'cancelada');
  const totalPeople = confirmed.reduce((sum, r) => sum + r.party_size, 0);
  const separator = '========================================';
  const dashSeparator = '----------------------------------------';
  const dotSeparator = '........................................';

  return (
    <div className="thermal-print">
      <div className="thermal-content">
        {/* Header */}
        <p className="text-center font-bold">RESTAURANTE</p>
        <p className="text-center">Sistema de Reservas</p>
        <p className="text-center">CNPJ: 00.000.000/0001-00</p>
        <p>{separator}</p>

        {/* Title */}
        <p className="text-center font-bold">RESERVAS DO DIA</p>
        <p className="text-center">
          {format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
        </p>
        <p>{dashSeparator}</p>

        {/* Reservations */}
        {confirmed.length === 0 ? (
          <p className="text-center">Nenhuma reserva para hoje</p>
        ) : (
          confirmed
            .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
            .map((r, idx) => (
              <div key={r.id} className="thermal-item">
                <p className="font-bold">
                  {String(idx + 1).padStart(2, '0')} {r.reservation_time} - {r.client_name}
                </p>
                <p>{"   "}Pessoas: {r.party_size} | Salao: {r.salon}</p>
                {r.preference && <p>{"   "}Pref: {r.preference}</p>}
                {r.client_phone && <p>{"   "}Tel: {r.client_phone}</p>}
                {r.notes && <p>{"   "}Obs: {r.notes}</p>}
                <p>{"   "}[{r.status.toUpperCase()}]</p>
                {idx < confirmed.length - 1 && <p>{dotSeparator}</p>}
              </div>
            ))
        )}

        {/* Footer */}
        <p>{separator}</p>
        <p className="font-bold">TOTAL RESERVAS: {confirmed.length}</p>
        <p className="font-bold">TOTAL PESSOAS: {totalPeople}</p>
        <p>{dashSeparator}</p>
        <p>Impresso: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        <p className="text-center mt-2">
          ✂ - - - - - - - - - - - - - - - - -
        </p>
      </div>
    </div>
  );
}