import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ShieldAlert, ShieldCheck, ShieldX, Lock, User, FileWarning } from 'lucide-react';
import { validateAdminPassword, CriticalAction, CRITICAL_ACTION_LABELS } from '@/lib/security';
import { addAuditLog } from '@/lib/auditLog';
import { toast } from 'sonner';

export interface AuthorizationRequest {
  action: CriticalAction;
  module: string;
  entityId?: string;
  entityLabel?: string;
  requestingUser: string;
  requestingRole: string;
  onAuthorized: (authorizedBy: string) => void;
  onCancelled?: () => void;
}

interface Props {
  request: AuthorizationRequest | null;
  onClose: () => void;
}

export default function AuthorizationDialog({ request, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = () => {
    if (!request) return;

    const result = validateAdminPassword(password);
    if (result.valid) {
      // Log the authorized action
      addAuditLog({
        userId: 'current',
        userName: request.requestingUser,
        userRole: request.requestingRole,
        module: request.module,
        action: `auth_${request.action}`,
        entityId: request.entityId || '',
        comment: `Acción autorizada: ${CRITICAL_ACTION_LABELS[request.action]}${request.entityLabel ? ` — ${request.entityLabel}` : ''}`,
        authorizedBy: result.userName,
        authorizedByRole: result.role,
      });

      toast.success('Acción autorizada', {
        description: `Autorizado por: ${result.userName}`,
      });

      request.onAuthorized(result.userName);
      handleClose();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError('Contraseña incorrecta');
      setPassword('');

      // Log failed attempt
      addAuditLog({
        userId: 'current',
        userName: request.requestingUser,
        userRole: request.requestingRole,
        module: request.module,
        action: `auth_failed_${request.action}`,
        entityId: request.entityId || '',
        comment: `Intento de autorización fallido (${newAttempts})`,
      });

      if (newAttempts >= 3) {
        toast.error('Acceso bloqueado', {
          description: 'Demasiados intentos fallidos. Acción cancelada.',
        });
        addAuditLog({
          userId: 'current',
          userName: request.requestingUser,
          userRole: request.requestingRole,
          module: request.module,
          action: `auth_blocked_${request.action}`,
          entityId: request.entityId || '',
          comment: `Acción bloqueada por exceder intentos`,
        });
        request.onCancelled?.();
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setAttempts(0);
    onClose();
  };

  const handleCancel = () => {
    request?.onCancelled?.();
    handleClose();
  };

  if (!request) return null;

  return (
    <Dialog open={!!request} onOpenChange={() => handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert size={20} />
            Autorización Requerida
          </DialogTitle>
          <DialogDescription>
            Esta acción requiere autorización del Administrador o Director.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action details */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">Usuario:</span>
              <span className="font-medium">{request.requestingUser}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileWarning size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">Acción:</span>
              <span className="font-medium text-destructive">{CRITICAL_ACTION_LABELS[request.action]}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">Módulo:</span>
              <span className="font-medium capitalize">{request.module}</span>
            </div>
            {request.entityLabel && (
              <div className="flex items-center gap-2 text-sm">
                <Lock size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Elemento:</span>
                <span className="font-medium">{request.entityLabel}</span>
              </div>
            )}
          </div>

          {/* Password input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Contraseña de autorización
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ingresa la contraseña del administrador"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-destructive">
                <ShieldX size={12} />
                {error} — Intento {attempts}/3
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            💡 Demo: usa <strong>redbuck2026</strong> (Director) o <strong>admin2026</strong> (Administración)
          </p>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!password}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Autorizar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
