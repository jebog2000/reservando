import { useEffect, useState } from 'react';
import { client } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, User, CheckCircle } from 'lucide-react';

interface UserData {
  id: string;
  email?: string;
  name?: string;
}

export default function Users() {
  const [user, setUser] = useState<UserData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await client.auth.me();
        if (response?.data) {
          setUser(response.data);
        }
      } catch {
        // User not available
      }
    };
    fetchUser();
  }, []);

  const handleCopyLink = async () => {
    const url = window.location.origin + '/login';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToLogin = () => {
    client.auth.toLogin();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1e3a5f]">Cadastro de Usuários</h1>
        <p className="text-gray-500 mt-1">Gerencie o acesso dos funcionários ao sistema</p>
      </div>

      {/* Current User Info */}
      <Card className="mb-6 border-[#1e3a5f]/10">
        <CardHeader>
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <User className="w-5 h-5" />
            Usuário Atual
          </CardTitle>
          <CardDescription>Informações do funcionário logado</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#1e3a5f] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                {user.name && (
                  <p className="font-semibold text-[#1e3a5f]">{user.name}</p>
                )}
                {user.email && (
                  <p className="text-gray-500 text-sm">{user.email}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Carregando informações...</p>
          )}
        </CardContent>
      </Card>

      {/* Share Access Card */}
      <Card className="border-[#f59e0b]/30 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-[#f59e0b]" />
            Compartilhar Acesso
          </CardTitle>
          <CardDescription>
            Convide novos funcionários para o sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-gray-700 text-sm leading-relaxed">
              Para cadastrar novos funcionários, compartilhe o link de acesso ao sistema.
              Eles poderão criar uma conta na página de login e terão acesso imediato
              ao sistema de reservas.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase">Link de Acesso</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm text-[#1e3a5f] font-mono truncate">
                {window.location.origin}/login
              </code>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className={`shrink-0 ${copied ? 'border-green-500 text-green-600' : 'border-[#1e3a5f] text-[#1e3a5f]'}`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleCopyLink}
              className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Link de Acesso
            </Button>
            <Button
              onClick={handleGoToLogin}
              variant="outline"
              className="border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ir para Página de Login
            </Button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>Como funciona:</strong> Envie o link acima para o novo funcionário.
              Ao acessar, ele poderá criar uma conta com email e senha. Após o cadastro,
              terá acesso completo ao sistema de reservas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}