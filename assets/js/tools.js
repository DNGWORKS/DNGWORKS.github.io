/**
 * DNGWORKS — calculators and the growth self-check.
 * Everything runs locally on the numbers the reader types. Nothing is sent,
 * nothing is stored, and no field arrives pre-filled.
 */

const root = document.querySelector('[data-tools]');
const locale = document.documentElement.lang || 'vi';

const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const num = (form, name) => {
  const field = form.elements.namedItem(name);
  if (!field) return NaN;
  const raw = String(field.value).replace(/[\s.,](?=\d{3}\b)/g, '').replace(',', '.');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : NaN;
};

function setReadout(form, text, state) {
  const readout = form.querySelector('[data-readout]');
  if (!readout) return;
  const value = readout.querySelector('[data-readout-value]');
  if (value) value.textContent = text;
  readout.dataset.state = state || 'filled';
}

/* ------------------------------------------------------------ calculators */

const CALCULATORS = {
  roas(form) {
    const spend = num(form, 'spend');
    const revenue = num(form, 'revenue');
    if (!(spend > 0) || !Number.isFinite(revenue)) return null;
    return `${nf2.format(revenue / spend)}×`;
  },

  breakeven(form) {
    const margin = num(form, 'margin');
    if (!(margin > 0) || margin > 100) return null;
    return `${nf2.format(100 / margin)}×`;
  },

  cac(form) {
    const cost = num(form, 'cost');
    const customers = num(form, 'customers');
    if (!(customers > 0) || !Number.isFinite(cost)) return null;
    return `${nf.format(Math.round(cost / customers))} ₫`;
  },

  ltv(form) {
    const aov = num(form, 'aov');
    const frequency = num(form, 'frequency');
    const lifespan = num(form, 'lifespan');
    if (![aov, frequency, lifespan].every((v) => Number.isFinite(v) && v > 0)) return null;
    return `${nf.format(Math.round(aov * frequency * lifespan))} ₫`;
  },

  ltvcac(form) {
    const ltv = num(form, 'ltv');
    const cac = num(form, 'cac');
    if (!(cac > 0) || !Number.isFinite(ltv)) return null;
    return `${nf2.format(ltv / cac)}×`;
  },
};

function initCalculators() {
  for (const form of root.querySelectorAll('[data-calc]')) {
    const key = form.dataset.calc;
    const compute = CALCULATORS[key];
    if (!compute) continue;

    const update = () => {
      const result = compute(form);
      setReadout(form, result ?? '—', result ? 'filled' : 'empty');
    };

    form.addEventListener('input', update);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      update();
    });
    update();
  }
}

/* ------------------------------------------------------------ utm builder */

function initUtm() {
  const form = root.querySelector('[data-utm]');
  if (!form) return;

  const output = form.querySelector('[data-utm-output]');
  const slug = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._~-]/g, '');

  const build = () => {
    const base = String(form.elements.namedItem('base')?.value || '').trim();
    if (!base) {
      output.textContent = '—';
      return;
    }

    let url;
    try {
      url = new URL(base);
    } catch {
      output.textContent = '—';
      output.dataset.invalid = 'true';
      return;
    }
    delete output.dataset.invalid;

    for (const key of ['source', 'medium', 'campaign', 'content']) {
      const value = slug(form.elements.namedItem(key)?.value);
      if (value) url.searchParams.set(`utm_${key}`, value);
      else url.searchParams.delete(`utm_${key}`);
    }
    output.textContent = url.toString();
  };

  form.addEventListener('input', build);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    build();
  });
  build();
}

/* ------------------------------------------------------------ growth check */

function initGrowthCheck() {
  const form = root.querySelector('[data-check]');
  if (!form) return;

  const result = form.querySelector('[data-check-result]');
  const labels = form.querySelector('[data-check-labels]');

  for (const range of form.querySelectorAll('input[type="range"]')) {
    const output = range.closest('.scale-row')?.querySelector('[data-scale-value]');
    const sync = () => {
      if (output) output.textContent = range.value;
    };
    range.addEventListener('input', sync);
    sync();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    /* Each pillar scores as the mean of its answers on the 1–5 scale,
       expressed as a share of the maximum. No composite grade is shown:
       the output is a priority order, not a rating. */
    const pillars = [...form.querySelectorAll('[data-pillar]')].map((block) => {
      const ranges = [...block.querySelectorAll('input[type="range"]')];
      const values = ranges.map((r) => Number(r.value) || 1);
      const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      return {
        key: block.dataset.pillar,
        title: block.dataset.pillarTitle || block.dataset.pillar,
        recommend: block.dataset.recommend || '',
        dontYet: block.dataset.dontYet || '',
        percent: Math.round(((mean - 1) / 4) * 100),
      };
    });

    if (!pillars.length) return;

    const sorted = [...pillars].sort((a, b) => a.percent - b.percent);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];

    if (labels) {
      labels.innerHTML = '';
      for (const pillar of pillars) {
        const level = pillar.percent < 34 ? 'low' : pillar.percent < 67 ? 'mid' : 'high';
        const row = document.createElement('div');
        row.className = 'meter-row';
        row.innerHTML =
          `<span class="meter-l"></span>` +
          `<span class="meter-track"><span class="meter-fill" data-level="${level}" style="width:${Math.max(pillar.percent, 2)}%"></span></span>` +
          `<span class="meter-v">${pillar.percent}%</span>`;
        row.querySelector('.meter-l').textContent = pillar.title;
        labels.append(row);
      }
    }

    for (const node of form.querySelectorAll('[data-fill]')) {
      const slot = node.dataset.fill;
      if (slot === 'weakest') node.textContent = weakest.title;
      if (slot === 'strongest') node.textContent = strongest.title;
      if (slot === 'recommend') node.textContent = weakest.recommend;
      if (slot === 'dontYet') node.textContent = weakest.dontYet;
    }

    if (result) {
      result.hidden = false;
      result.focus?.();
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      if (result) result.hidden = true;
      for (const range of form.querySelectorAll('input[type="range"]')) {
        const output = range.closest('.scale-row')?.querySelector('[data-scale-value]');
        if (output) output.textContent = range.value;
      }
    }, 0);
  });
}

if (root) {
  initCalculators();
  initUtm();
  initGrowthCheck();
}
