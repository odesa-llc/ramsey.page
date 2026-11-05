document.querySelectorAll('[data-copy-email]').forEach(button => {
  const status = button.parentElement.querySelector('[role="status"]');
  let resetTimer;

  button.addEventListener('click', async () => {
    clearTimeout(resetTimer);
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
      status.textContent = window.portfolioText('runtime.emailCopied');
    } catch {
      status.textContent = window.portfolioText('runtime.emailCopyFailed');
    }
    resetTimer = setTimeout(() => { status.textContent = ''; }, 3000);
  });
});
