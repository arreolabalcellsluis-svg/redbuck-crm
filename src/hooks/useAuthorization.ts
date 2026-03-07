import { useState, useCallback, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { CriticalAction, requiresAuthorization, CRITICAL_ACTION_LABELS } from '@/lib/security';
import { AuthorizationRequest } from '@/components/shared/AuthorizationDialog';
import { toast } from 'sonner';
import { addAuditLog } from '@/lib/auditLog';

// Map roles to display names
const ROLE_DISPLAY: Record<string, string> = {
  director: 'Director',
  gerencia_comercial: 'Gerencia Comercial',
  vendedor: 'Vendedor',
  administracion: 'Administración',
  compras: 'Compras',
  almacen: 'Almacén',
  tecnico: 'Técnico',
};

const USER_DISPLAY: Record<string, string> = {
  director: 'Carlos Mendoza',
  gerencia_comercial: 'Laura Ríos',
  vendedor: 'Roberto Juárez',
  administracion: 'Patricia López',
  compras: 'Héctor Morales',
  almacen: 'Ramón Flores',
  tecnico: 'Jorge Pérez',
};

export function useAuthorization() {
  const { currentRole } = useAppContext();
  const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null);

  const requestAuthorization = useCallback((
    action: CriticalAction,
    module: string,
    onAuthorized: (authorizedBy: string) => void,
    options?: { entityId?: string; entityLabel?: string; onCancelled?: () => void }
  ) => {
    const needsAuth = requiresAuthorization(currentRole, action);

    if (!needsAuth) {
      // Director or role with permission — execute directly
      addAuditLog({
        userId: 'current',
        userName: USER_DISPLAY[currentRole] || currentRole,
        userRole: currentRole,
        module,
        action: action,
        entityId: options?.entityId || '',
        comment: `${CRITICAL_ACTION_LABELS[action]}${options?.entityLabel ? ` — ${options.entityLabel}` : ''} (auto-autorizado)`,
        authorizedBy: USER_DISPLAY[currentRole] || currentRole,
        authorizedByRole: currentRole,
      });
      onAuthorized(USER_DISPLAY[currentRole] || currentRole);
      return;
    }

    // Requires 2nd-level authorization
    setAuthRequest({
      action,
      module,
      entityId: options?.entityId,
      entityLabel: options?.entityLabel,
      requestingUser: USER_DISPLAY[currentRole] || currentRole,
      requestingRole: ROLE_DISPLAY[currentRole] || currentRole,
      onAuthorized,
      onCancelled: options?.onCancelled,
    });
  }, [currentRole]);

  const closeAuth = useCallback(() => {
    setAuthRequest(null);
  }, []);

  return { authRequest, requestAuthorization, closeAuth };
}
