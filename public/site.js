document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const status = document.querySelector('.toast');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    status.textContent = '引用已复制';
  } catch {
    const selection = document.createElement('textarea');
    selection.value = button.dataset.copy;
    selection.setAttribute('aria-label', '引用文本，请手动复制');
    button.parentElement.append(selection);
    selection.focus(); selection.select();
    status.textContent = '请复制已选中的引用文本';
  }
  status.classList.add('visible');
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => status.classList.remove('visible'), 3500);
});
