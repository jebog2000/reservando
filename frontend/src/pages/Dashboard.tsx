import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ThermalPrint from '@/components/ThermalPrint';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, ChevronLeft, ChevronRight, Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultPrinter, setDefaultPrinter] = useState<any>(null);

  const today = new Date();

  useEffect(() => {
    fetchMonthReservations();
    const interval = setInterval(() => {
      fetchMonthReservations();
    }, 30000);
    return () => clearInterval(interval);
  }, [currentMonth]);

  useEffect(() => {
    const fetchDefaultPrinter = async () => {
      try {
        const response = await client.entities.printer_settings.query({});
        const printers = response.data?.items || [];
        const def = printers.find((p: any) => p.is_default);
        setDefaultPrinter(def || null);
      } catch {
        // silently fail, will use local print
      }
    };
    fetchDefaultPrinter();
  }, []);

  const fetchMonthReservations = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const response = await client.entities.reservations.queryAll({
        query: {
          reservation_date__gte: start,
          reservation_date__lte: end,
        },
        sort: 'reservation_date',
        limit: 200,
      });
      setReservations(response?.data?.items || []);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const getReservationsForDay = (day: Date): Reservation[] => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return reservations.filter((r) => r.reservation_date === dateStr && r.status !== 'cancelada');
  };

  const getTodayReservations = (): Reservation[] => {
    const dateStr = format(today, 'yyyy-MM-dd');
    return reservations.filter((r) => r.reservation_date === dateStr);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setDayReservations(getReservationsForDay(day));
  };



  const buildPrintHtml = (innerHTML: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Reservas do Dia</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
      background: #fff;
      font-weight: 700;
    }
    .thermal-print {
      width: 76mm;
      padding: 2mm;
    }
    p {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-weight: 700;
      -webkit-text-stroke: 0.3px #000;
    }
    .thermal-item { margin-bottom: 1px; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 900; }
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body { width: 80mm; }
    }
  </style>
</head>
<body>
  ${innerHTML}
</body>
</html>`;
  };

  const printLocal = (htmlContent: string) => {
    const printWindow = window.open('', '_blank', 'width=700,height=400');
    if (!printWindow) return;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const handlePrint = async () => {
    const printContent = document.querySelector('.thermal-print');
    if (!printContent) return;

    const htmlContent = buildPrintHtml(printContent.innerHTML);

    if (
      defaultPrinter &&
      defaultPrinter.printer_type === 'printnode' &&
      defaultPrinter.printnode_api_key &&
      defaultPrinter.printnode_printer_id
    ) {
      try {
        // Create offscreen container with the styled HTML
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '302px'; // 80mm at 96dpi
        container.innerHTML = printContent.innerHTML;
        document.body.appendChild(container);

        // Render to canvas
        const canvas = await html2canvas(container, {
          width: 302,
          scale: 2,
          backgroundColor: '#ffffff',
        });

        document.body.removeChild(container);

        // Create PDF (80mm wide, height based on content)
        const imgWidth = 80; // mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [imgWidth, imgHeight],
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        // Get base64 PDF (remove data URI prefix)
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // Send to PrintNode
        const response = await fetch('https://api.printnode.com/printjobs', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(defaultPrinter.printnode_api_key + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            printerId: parseInt(defaultPrinter.printnode_printer_id),
            title: 'Reservas do Dia',
            contentType: 'pdf_base64',
            content: pdfBase64,
          }),
        });

        if (response.ok) {
          toast.success('Impressão enviada para ' + (defaultPrinter.printer_name || 'PrintNode'));
        } else {
          toast.error('Erro ao enviar impressão para PrintNode');
          printLocal(htmlContent);
        }
      } catch (err) {
        console.error('PrintNode error:', err);
        toast.error('Erro ao enviar impressão para PrintNode');
        printLocal(htmlContent);
      }
    } else {
      printLocal(htmlContent);
    }
  };

  const buildSingleReservationTicketHtml = (r: Reservation): string => {
    // Calculate font size based on name length to prevent cutting
    const nameLen = r.client_name.length;
    let fontSize = '72pt';
    if (nameLen > 20) fontSize = '40pt';
    else if (nameLen > 15) fontSize = '48pt';
    else if (nameLen > 10) fontSize = '56pt';
    else if (nameLen > 7) fontSize = '64pt';

    return `<!DOCTYPE html>
<html>
<head>
  <title>${r.client_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 210mm;
      height: 80mm;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #000;
      background: #fff;
    }
    .ticket {
      width: 210mm;
      height: 80mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5mm;
      border: 0.5pt solid #000;
    }
    .name {
      font-size: ${fontSize};
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
      word-break: break-word;
      line-height: 1.2;
      width: 100%;
    }
    @page {
      size: 210mm 80mm landscape;
      margin: 0;
    }
    @media print {
      html, body { width: 210mm; height: 80mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="name">${r.client_name.toUpperCase()}</div>
  </div>
</body>
</html>`;
  };

  const handlePrintSingleReservation = async (r: Reservation) => {
    const htmlContent = buildSingleReservationTicketHtml(r);

    if (
      defaultPrinter &&
      defaultPrinter.printer_type === 'printnode' &&
      defaultPrinter.printnode_api_key &&
      defaultPrinter.printnode_printer_id
    ) {
      try {
        // 210mm x 80mm landscape at 96dpi = ~794px x 302px
        const nameLen = r.client_name.length;
        let pxFontSize = '96px';
        if (nameLen > 20) pxFontSize = '54px';
        else if (nameLen > 15) pxFontSize = '64px';
        else if (nameLen > 10) pxFontSize = '76px';
        else if (nameLen > 7) pxFontSize = '86px';

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '794px';
        container.style.height = '302px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.padding = '16px';
        container.innerHTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: ${pxFontSize}; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; word-break: break-word; line-height: 1.2; width: 100%;">${r.client_name.toUpperCase()}</div>`;
        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
          width: 794,
          height: 302,
          scale: 2,
          backgroundColor: '#ffffff',
        });

        document.body.removeChild(container);

        // PDF: 210mm wide x 80mm tall (landscape)
        const imgWidth = 210;
        const imgHeight = 80;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [imgHeight, imgWidth],
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        const response = await fetch('https://api.printnode.com/printjobs', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(defaultPrinter.printnode_api_key + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            printerId: parseInt(defaultPrinter.printnode_printer_id),
            title: `Reserva - ${r.client_name}`,
            contentType: 'pdf_base64',
            content: pdfBase64,
          }),
        });

        if (response.ok) {
          toast.success('Ticket enviado para ' + (defaultPrinter.printer_name || 'PrintNode'));
        } else {
          toast.error('Erro ao enviar ticket para PrintNode');
          printLocal(htmlContent);
        }
      } catch (err) {
        console.error('PrintNode error:', err);
        toast.error('Erro ao enviar ticket para PrintNode');
        printLocal(htmlContent);
      }
    } else {
      printLocal(htmlContent);
    }
  };

  const handleWhatsApp = () => {
    const todayRes = getTodayReservations()
      .filter((r) => r.status !== 'cancelada')
      .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));

    const dateStr = format(today, 'dd/MM/yyyy');
    let message = `*RESERVAS DO DIA*\n📅 ${dateStr}\n\n`;

    if (todayRes.length === 0) {
      message += 'Nenhuma reserva para hoje.\n';
    } else {
      todayRes.forEach((r, i) => {
        message += `${i + 1}. *${r.client_name}*\n`;
        message += `⏰ ${r.reservation_time} | 👥 ${r.party_size} pessoas\n`;
        message += `📍 ${r.salon}\n`;
        if (r.preference) message += `🍽️ ${r.preference}\n`;
        message += `Status: ${r.status}\n`;
        if (r.client_phone) message += `📞 ${r.client_phone}\n`;
        if (r.notes) message += `📝 ${r.notes}\n`;
        message += '\n';
      });

      const totalPeople = todayRes.reduce((sum, r) => sum + (r.party_size || 0), 0);
      message += `*Total: ${todayRes.length} reservas | ${totalPeople} pessoas*`;
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Dashboard</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/reservas')}
            className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            NOVA RESERVA
          </Button>
          <Button
            onClick={handleWhatsApp}
            className="bg-[#25D366] hover:bg-[#1da851] text-white gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WHATSAPP
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-[#f59e0b] hover:bg-[#d97706] text-white gap-2"
          >
            <Printer className="w-4 h-4" />
            RESERVAS DO DIA
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Reservas Hoje</p>
                <p className="text-2xl font-bold text-[#1e3a5f]">
                  {getTodayReservations().filter((r) => r.status !== 'cancelada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-[#f59e0b]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pessoas Hoje</p>
                <p className="text-2xl font-bold text-[#1e3a5f]">
                  {getTodayReservations()
                    .filter((r) => r.status !== 'cancelada')
                    .reduce((sum, r) => sum + (r.party_size || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Reservas no Mês</p>
                <p className="text-2xl font-bold text-[#1e3a5f]">
                  {reservations.filter((r) => r.status !== 'cancelada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg text-[#1e3a5f] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}
              {days.map((day) => {
                const dayRes = getReservationsForDay(day);
                const count = dayRes.length;
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`p-2 rounded-lg text-center transition-colors relative min-h-[60px] flex flex-col items-center justify-start ${
                      isToday
                        ? 'bg-[#1e3a5f] text-white'
                        : count > 0
                        ? 'bg-amber-50 hover:bg-amber-100'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-sm font-medium ${isToday ? 'text-white' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </span>
                    {count > 0 && (
                      <span
                        className={`text-xs mt-1 px-1.5 py-0.5 rounded-full ${
                          isToday ? 'bg-[#f59e0b] text-white' : 'bg-[#f59e0b] text-white'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">
              Reservas - {selectedDay && format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {dayReservations.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma reserva para este dia</p>
            ) : (
              dayReservations
                .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
                .map((r) => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#1e3a5f]">{r.client_name}</span>
                      <span className="text-sm bg-[#1e3a5f] text-white px-2 py-0.5 rounded">
                        {r.reservation_time}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {r.party_size} pessoas • {r.salon}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-gray-400 mt-1">Obs: {r.notes}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'confirmada' ? 'bg-green-100 text-green-700' :
                        r.status === 'a confirmar' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'concluída' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-[#f59e0b] text-[#f59e0b] hover:bg-amber-50"
                          onClick={() => handlePrintSingleReservation(r)}
                        >
                          <Printer className="w-3 h-3 mr-1" />
                          Imprimir
                        </Button>
                        {r.status !== 'confirmada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-green-500 text-green-700 hover:bg-green-50"
                            onClick={async () => {
                              try {
                                await client.apiCall.invoke({
                                  url: `/api/v1/entities/reservations/all/${r.id}`,
                                  method: 'PUT',
                                  data: { status: 'confirmada' },
                                });
                                setDayReservations((prev) =>
                                  prev.map((res) =>
                                    res.id === r.id ? { ...res, status: 'confirmada' } : res
                                  )
                                );
                                setReservations((prev) =>
                                  prev.map((res) =>
                                    res.id === r.id ? { ...res, status: 'confirmada' } : res
                                  )
                                );
                                toast.success('Reserva confirmada!');
                              } catch (err) {
                                console.error('Error confirming reservation:', err);
                                toast.error('Erro ao confirmar reserva');
                              }
                            }}
                          >
                            ✓ Confirmar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Thermal Print (hidden, only shows on print) */}
      <ThermalPrint reservations={getTodayReservations()} date={today} />
    </div>
  );
}