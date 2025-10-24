document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const openModalButton = target.closest('[data-open-modal]');

  if (openModalButton) {
    const view = openModalButton.getAttribute('data-open-modal') || 'login';
    document.dispatchEvent(
      new CustomEvent('open-auth-modal', {
        detail: { view },
        bubbles: true,
      })
    );
  }
});
