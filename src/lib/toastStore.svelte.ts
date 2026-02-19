import { generateUUID } from './utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

class ToastStore {
  #toasts = $state<ToastMessage[]>([]);

  get messages() {
    return this.#toasts;
  }

  add(type: ToastType, message: string, duration = 4000) {
    const id = generateUUID();
    const toastItem: ToastMessage = { id, type, message, duration };

    this.#toasts.push(toastItem);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  remove(id: string) {
    this.#toasts = this.#toasts.filter((t) => t.id !== id);
  }

  success(msg: string, duration?: number) {
    this.add('success', msg, duration);
  }
  error(msg: string, duration?: number) {
    this.add('error', msg, duration);
  }
  info(msg: string, duration?: number) {
    this.add('info', msg, duration);
  }
  warning(msg: string, duration?: number) {
    this.add('warning', msg, duration);
  }
}

export const toast = new ToastStore();
