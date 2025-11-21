document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-link-form');
  const submitBtn = document.getElementById('create-link-submit');
  const errorEl = document.getElementById('create-link-error');
  const successEl = document.getElementById('create-link-success');
  const tableBody = document.getElementById('links-table-body');
  const searchInput = document.getElementById('search-input');
  const toastRoot = document.getElementById('toast-root');

  function showToast(message, variant = 'success', timeout = 3000) {
    if (!toastRoot) return;
    const div = document.createElement('div');
    div.className = `toast ${variant === 'success' ? 'toast-success' : 'toast-error'}`;
    div.textContent = message;
    toastRoot.appendChild(div);
    setTimeout(() => {
      div.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => div.remove(), 200);
    }, timeout);
  }

  async function handleCopyClick(e) {
    const btn = e.currentTarget;
    const url = btn.dataset.url;
    if (!url || !navigator.clipboard) {
      showToast('Copy failed. Your browser may not support clipboard.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Short URL copied to clipboard');
    } catch (err) {
      console.error('Copy failed', err);
      showToast('Copy failed. Please try manually.', 'error');
    }
  }

  function wireCopyButtons(scope = document) {
    scope.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.removeEventListener('click', handleCopyClick);
      btn.addEventListener('click', handleCopyClick);
    });
  }

  async function handleDeleteClick(e) {
    const btn = e.currentTarget;
    const code = btn.dataset.code;
    if (!code) return;
    const row = document.querySelector(`tr[data-code="${code}"]`);
    const confirmed = confirm(`Delete /${code}? This cannot be undone.`);
    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      const res = await fetch(`/api/links/${code}`, { method: 'DELETE' });
      if (res.status === 204 || res.status === 200) {
        if (row) row.remove();
        showToast(`Deleted /${code}`);
      } else if (res.status === 404) {
        showToast('Link not found (maybe already deleted).', 'error');
      } else {
        showToast('Could not delete link.', 'error');
      }
    } catch (err) {
      console.error('Delete failed', err);
      showToast('Could not delete link.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  }

  function wireDeleteButtons(scope = document) {
    scope.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.removeEventListener('click', handleDeleteClick);
      btn.addEventListener('click', handleDeleteClick);
    });
  }

  // Filter table rows by search query
  function wireSearch() {
    if (!searchInput || !tableBody) return;
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const rows = tableBody.querySelectorAll('tr');
      rows.forEach((row) => {
        const code = (row.dataset.code || '').toLowerCase();
        const url = (row.dataset.url || '').toLowerCase();
        const match = code.includes(q) || url.includes(q);
        row.style.display = match ? '' : 'none';
      });
    });
  }

  // Handle create link form
  if (form && submitBtn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl && (errorEl.classList.add('hidden'), errorEl.textContent = '');
      successEl && (successEl.classList.add('hidden'), successEl.textContent = '');

      const formData = new FormData(form);
      const targetUrl = (formData.get('targetUrl') || '').toString().trim();
      const code = (formData.get('code') || '').toString().trim();

      if (!targetUrl) {
        if (errorEl) {
          errorEl.textContent = 'Please enter a URL.';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      // Basic client-side validation
      try {
        const url = new URL(targetUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        if (errorEl) {
          errorEl.textContent = 'Please enter a valid URL starting with http:// or https://.';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      if (code && !/^[A-Za-z0-9]{6,8}$/.test(code)) {
        if (errorEl) {
          errorEl.textContent = 'Custom code must be 6–8 characters, letters and numbers only.';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      // Loading state
      submitBtn.disabled = true;
      const defaultLabel = submitBtn.querySelector('.button-label-default');
      const loadingLabel = submitBtn.querySelector('.button-label-loading');
      if (defaultLabel && loadingLabel) {
        defaultLabel.classList.add('hidden');
        loadingLabel.classList.remove('hidden');
      }

      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetUrl, code: code || undefined }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = data.error || 'Failed to create short link.';
          if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
          }
          showToast(msg, 'error');
          return;
        }

        // Success
        if (successEl) {
          successEl.textContent = `Created short URL: ${data.shortUrl}`;
          successEl.classList.remove('hidden');
        }
        showToast('Short link created');

        form.reset();

        // If table exists, prepend new row
        if (tableBody) {
          const tr = document.createElement('tr');
          tr.className = 'table-row';
          tr.dataset.code = data.code;
          tr.dataset.url = data.targetUrl;

          tr.innerHTML = `
            <td class="table-td align-top">
              <div class="flex flex-col gap-1">
                <a href="/code/${data.code}" class="inline-flex items-center gap-1 font-mono text-[0.75rem] text-sky-300 hover:text-sky-200">
                  /${data.code}
                  <span class="text-[0.6rem] uppercase bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">Stats</span>
                </a>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-[0.7rem] text-slate-400 hover:text-slate-100 copy-btn"
                  data-url="${data.shortUrl}"
                >
                  Copy short URL
                </button>
              </div>
            </td>
            <td class="table-td align-top max-w-xs sm:max-w-md">
              <div class="truncate text-[0.72rem] text-slate-200" title="${data.targetUrl}">
                ${data.targetUrl}
              </div>
              <div class="text-[0.65rem] text-slate-500 mt-1">
                Created just now
              </div>
            </td>
            <td class="table-td align-top text-center text-[0.8rem] font-medium text-slate-50">
              ${data.totalClicks ?? 0}
            </td>
            <td class="table-td align-top text-[0.7rem] text-slate-300">
              <span class="text-slate-500">Never</span>
            </td>
            <td class="table-td align-top text-right">
              <button
                type="button"
                class="btn-ghost text-[0.7rem] delete-btn"
                data-code="${data.code}"
              >
                Delete
              </button>
            </td>
          `;

          tableBody.prepend(tr);
          wireCopyButtons(tr);
          wireDeleteButtons(tr);
        }
      } catch (err) {
        console.error('Create link failed', err);
        if (errorEl) {
          errorEl.textContent = 'Unexpected error. Please try again.';
          errorEl.classList.remove('hidden');
        }
        showToast('Unexpected error. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        if (defaultLabel && loadingLabel) {
          defaultLabel.classList.remove('hidden');
          loadingLabel.classList.add('hidden');
        }
      }
    });
  }

  wireCopyButtons();
  wireDeleteButtons();
  wireSearch();
});
