import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e]">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-[#f59e0b] rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Sistema de Reservas</h1>
        <p className="text-gray-500 mb-6">Acesse sua conta para gerenciar as reservas do restaurante</p>
        <Button
          onClick={() => client.auth.toLogin()}
          className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white text-lg py-6"
        >
          Entrar
        </Button>
      </div>
    </div>
  );
}