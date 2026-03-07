import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetSent, setResetSent] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError('Error al enviar el correo de recuperación.');
    } else {
      setResetSent(true);
      toast.success('Correo de recuperación enviado');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-card rounded-2xl border shadow-xl p-8 space-y-6">
          {/* Brand */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-display font-bold text-xl"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              RB
            </div>
            <h1 className="text-2xl font-display font-bold">REDBUCK</h1>
            <p className="text-xs tracking-widest uppercase text-muted-foreground">ERP · CRM · EQUIPMENT</p>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Correo electrónico</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@redbuck.mx"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Contraseña</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>

              <button type="button" onClick={() => setMode('forgot')}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {resetSent ? (
                <div className="text-center space-y-3">
                  <div className="text-sm text-success bg-success/10 rounded-lg p-3">
                    ✅ Correo enviado. Revisa tu bandeja de entrada.
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setResetSent(false); }}
                    className="text-sm text-primary hover:underline">
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="tu@redbuck.mx"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>

                  <button type="button" onClick={() => setMode('login')}
                    className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                    Volver al inicio de sesión
                  </button>
                </>
              )}
            </form>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            Solo usuarios autorizados. Contacta al Director para obtener acceso.
          </p>
        </div>
      </div>
    </div>
  );
}
