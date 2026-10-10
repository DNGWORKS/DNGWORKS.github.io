/**
 * DNGWORKS — contact form.
 *
 * The form never claims success it cannot verify. With no endpoint
 * configured it says so plainly and points at the direct channels; with an
 * endpoint it reports the real outcome of the request.
 * Configure the destination in content/site.json → contact.formEndpoint.
 */

const form = document.querySelector('[data-contact-form]');
if (form) {
  const strings = JSON.parse(form.dataset.strings || '{}');
  const endpoint = (form.dataset.endpoint || '').trim();
  const status = document.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');

  const setFieldError = (field, message) => {
    const wrapper = field.closest('.field');
    const slot = wrapper?.querySelector('.field-error');
    if (wrapper) wrapper.dataset.invalid = message ? 'true' : 'false';
    if (slot) slot.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  const showStatus = (kind, title, body) => {
    if (!status) return;
    status.hidden = false;
    status.className = `notice form-status ${kind === 'error' ? 'notice--warn' : 'notice--mint'}`;
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    status.textContent = '';
    const wrap = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = title;
    strong.style.display = 'block';
    wrap.append(strong);
    if (body) {
      const p = document.createElement('span');
      p.textContent = body;
      wrap.append(p);
    }
    status.append(wrap);
    status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const validate = () => {
    let firstInvalid = null;

    for (const field of form.querySelectorAll('[data-required]')) {
      const value = String(field.value || '').trim();
      let message = '';
      if (!value) {
        message = strings.requiredField || 'This field is needed.';
      } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        message = strings.invalidEmail || 'Invalid email.';
      }
      setFieldError(field, message);
      if (message && !firstInvalid) firstInvalid = field;
    }

    return firstInvalid;
  };

  form.addEventListener('input', (event) => {
    const field = event.target;
    if (field.hasAttribute('data-required') && field.closest('.field')?.dataset.invalid === 'true') {
      const value = String(field.value || '').trim();
      if (value) setFieldError(field, '');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const invalid = validate();
    if (invalid) {
      showStatus('error', strings.errorTitle || 'Not sent', strings.errorValidation || '');
      invalid.focus();
      return;
    }

    if (!endpoint) {
      showStatus('error', strings.errorTitle || 'Not sent', strings.errorNoEndpoint || '');
      return;
    }

    const originalLabel = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = strings.sending || 'Sending';
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      form.reset();
      showStatus('success', strings.successTitle || 'Received', strings.success || '');
    } catch {
      showStatus('error', strings.errorTitle || 'Not sent', strings.errorNetwork || '');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel || strings.submit || 'Send';
      }
    }
  });
}
