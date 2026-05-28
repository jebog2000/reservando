import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Query from './pages/Query';
import Users from './pages/Users';
import Salons from './pages/Salons';
import Printers from './pages/Printers';
import Clients from './pages/Clients';
import Layout from './components/Layout';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route element={<Layout />}>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reservas" element={<Reservations />} />
      <Route path="/consultar" element={<Query />} />
      <Route path="/clientes" element={<Clients />} />
      <Route path="/saloes" element={<Salons />} />
      <Route path="/usuarios" element={<Users />} />
      <Route path="/impressoras" element={<Printers />} />
    </Route>
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };