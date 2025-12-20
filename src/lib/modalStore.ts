import { writable } from 'svelte/store';

interface ModalState {
  isOpen: boolean;
  view: 'login' | 'register' | 'link';
  successMessage: string;
  linkAccountInfo: {
    email: string | null;
    pendingCredential?: any | null;
  };
}

function createModalStore() {
  const { subscribe, update } = writable<ModalState>({
    isOpen: false,
    view: 'login',
    successMessage: '',
    linkAccountInfo: { email: null, pendingCredential: undefined }, // Initialize with explicit undefined for optional
  });

  return {
    subscribe,
    open: (
      view: 'login' | 'register' | 'link' = 'login',
      successMessage: string = ''
    ) =>
      update((state) => ({
        ...state,
        isOpen: true,
        view,
        successMessage,
        linkAccountInfo:
          view === 'link'
            ? state.linkAccountInfo
            : { email: null, pendingCredential: undefined }, // Reset to explicit undefined
      })),
    openForLinking: (
      email: string | null | undefined,
      pendingCredential: any
    ) =>
      update((state) => ({
        ...state,
        isOpen: true,
        view: 'link',
        linkAccountInfo: { email: email ?? null, pendingCredential },
      })),
    close: () =>
      update((state) => ({
        ...state,
        isOpen: false,
        successMessage: '',
        linkAccountInfo: { email: null, pendingCredential: undefined }, // Reset to explicit undefined
      })),
    switchTo: (view: 'login' | 'register' | 'link') =>
      update((state) => ({ ...state, view })),
  };
}

export const authModal = createModalStore();
