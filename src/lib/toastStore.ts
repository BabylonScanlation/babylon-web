import { writable } from 'svelte/store';
import { generateUUID } from './utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);

  const add = (type: ToastType, message: string, duration = 4000) => {
    const id = generateUUID();
    const toast: ToastMessage = { id, type, message, duration };

    update((toasts) => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
  };

  const remove = (id: string) => {
    update((toasts) => toasts.filter((t) => t.id !== id));
  };

  return {
    subscribe,
    success: (msg: string, duration?: number) => add('success', msg, duration),
    error: (msg: string, duration?: number) => add('error', msg, duration),
    info: (msg: string, duration?: number) => add('info', msg, duration),
    warning: (msg: string, duration?: number) => add('warning', msg, duration),
    remove,
  };
}

export const toast = createToastStore();
