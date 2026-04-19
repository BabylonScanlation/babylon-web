import type { User } from '../types';

/**
 * Verifica si un usuario tiene permisos sobre un scanlation específico.
 */
export function canManageScanlation(
  user: User | undefined,
  scanlationId: number | null | undefined
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!scanlationId) return false;

  return user.scanlations?.some((s) => s.id === scanlationId) ?? false;
}

/**
 * Verifica si un usuario es miembro de cualquier scanlation.
 */
export function isScanlationMember(user: User | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return (user.scanlations?.length ?? 0) > 0;
}

/**
 * Obtiene el primer scanlation ID del usuario si existe.
 */
export function getPrimaryScanlationId(user: User | undefined): number | undefined {
  return user?.scanlations?.[0]?.id;
}
