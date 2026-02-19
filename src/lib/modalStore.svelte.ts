interface ModalState {
  isOpen: boolean;
  view: 'login' | 'register' | 'link';
  successMessage: string;
  linkAccountInfo: {
    email: string | null;
    pendingCredential?: any | null;
  };
}

class AuthModalStore {
  #state = $state<ModalState>({
    isOpen: false,
    view: 'login',
    successMessage: '',
    linkAccountInfo: { email: null, pendingCredential: undefined },
  });

  get isOpen() {
    return this.#state.isOpen;
  }
  get view() {
    return this.#state.view;
  }
  get successMessage() {
    return this.#state.successMessage;
  }
  get linkAccountInfo() {
    return this.#state.linkAccountInfo;
  }

  open(view: 'login' | 'register' | 'link' = 'login', successMessage: string = '') {
    this.#state.isOpen = true;
    this.#state.view = view;
    this.#state.successMessage = successMessage;
    if (view !== 'link') {
      this.#state.linkAccountInfo = { email: null, pendingCredential: undefined };
    }
  }

  openForLinking(email: string | null | undefined, pendingCredential: any) {
    this.#state.isOpen = true;
    this.#state.view = 'link';
    this.#state.linkAccountInfo = { email: email ?? null, pendingCredential };
  }

  close() {
    this.#state.isOpen = false;
    this.#state.successMessage = '';
    this.#state.linkAccountInfo = { email: null, pendingCredential: undefined };
  }

  switchTo(view: 'login' | 'register' | 'link') {
    this.#state.view = view;
  }
}

export const authModal = new AuthModalStore();
