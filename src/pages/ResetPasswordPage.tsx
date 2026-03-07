import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError('Error al actualizar la contraseña. Intenta de nuevo.');
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <div className="w-full max-w-md px-4">
        <div className="bg-card rounded-2xl border shadow-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-display font-bold text-xl"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              RB
            </div>
            <h1 className="text-xl font-display font-bold">Restablecer contraseña</h1>
          </div>

          {success ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-success bg-success/10 rounded-lg p-4">
                <CheckCircle size={20} />
                <span>Contraseña actualizada correctamente</span>
              </div>
              <p className="text-sm text-muted-foreground">Redirigiendo...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Confirmar contraseña</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10"
                    placeholder="Repite la contraseña"
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
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
