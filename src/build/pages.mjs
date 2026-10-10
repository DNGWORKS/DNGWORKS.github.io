/**
 * Page bodies. Each export returns the <main> contents for one page.
 */

import {
  esc,
  attr,
  jsonAttr,
  join,
  map,
  href,
  articlePath,
  truncate,
  withHeadingIds,
} from './lib.mjs';
import { icons, ctaBand, figure } from './shell.mjs';

/* ------------------------------------------------------------- formatting */

const dateFormatters = new Map();
function formatDate(iso, lang) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (!dateFormatters.has(lang.code)) {
    dateFormatters.set(
      lang.code,
      new Intl.DateTimeFormat(lang.code, { day: '2-digit', month: 'short', year: 'numeric' })
    );
  }
  return dateFormatters.get(lang.code).format(date);
}

function timeTag(record, lang, t) {
  const formatted = formatDate(record.publishedAt, lang);
  if (!formatted) {
    return `<time class="story-time" data-unknown="true">${esc(t.ui.unknownDate)}</time>`;
  }
  return `<time class="story-time" datetime="${attr(record.publishedAt)}">${esc(formatted)}</time>`;
}

function storyMeta(record, lang, t) {
  return `<div class="story-meta">
            <span class="story-kind" data-type="${attr(record.type)}">${esc(
    t.intelligence.types[record.type] || record.type
  )}</span>
            ${record.sourceName ? `<span class="story-source">${esc(record.sourceName)}</span>` : ''}
            ${timeTag(record, lang, t)}
          </div>`;
}

function storyHref(record, lang) {
  if (record.localPath) return href(lang, record.localPath);
  return record.canonicalUrl || '#';
}

function storyLinkAttrs(record) {
  if (record.localPath) return '';
  return ' target="_blank" rel="noopener nofollow"';
}

function storyImage(record, options = {}) {
  const usable = record.imageRightsStatus === 'approved' && record.imageUrl;
  return figure({
    src: usable ? record.imageUrl : null,
    alt: usable ? record.title : options.placeholderAlt || '',
    ratio: options.ratio || '16x9',
    eager: options.eager,
    category: (record.categorySlugs || [])[0] || 'business-market',
    sizes: options.sizes,
  });
}

/* ================================================================== HOME */

export function home({ site, lang, t, articles, news }) {
  const hero = t.home.hero;

  const rail = map(
    hero.stages,
    (stage, index) => `          <li data-active="${index === 0 ? 'true' : 'false'}">
            <span class="hero-rail-label">${esc(stage.label)}</span>
            <span class="hero-rail-note">${esc(stage.note)}</span>
          </li>`
  );

  const diagnose = map(
    t.home.diagnose.items,
    (item) => `          <article class="panel panel--solid">
            <h3 class="panel-title">${esc(item.title)}</h3>
            <p class="panel-body">${esc(item.description)}</p>
            <p class="panel-note">${esc(item.symptom)}</p>
          </article>`
  );

  const approach = map(
    t.home.approach.steps,
    (step) => `          <li>
            <div>
              <h3>${esc(step.title)}</h3>
              <p>${esc(step.description)}</p>
            </div>
          </li>`
  );

  const services = map(
    t.services.items,
    (item) => `        <article class="service-row">
          <div>
            <h3>${esc(item.title)}</h3>
            <ul class="flow">${map(item.flow, (f) => `<li>${esc(f)}</li>`)}</ul>
          </div>
          <div>
            <p>${esc(item.problem)}</p>
            <ul class="chips">${map(item.tools, (tool) => `<li class="chip">${esc(tool)}</li>`)}</ul>
          </div>
          <div>
            <ul class="list-marked">${map(
              item.deliverables.slice(0, 3),
              (d) => `<li>${esc(d)}</li>`
            )}</ul>
          </div>
        </article>`
  );

  const toolCards = map(
    t.tools.calculators.slice(0, 3),
    (calc) => `          <article class="panel">
            <h3 class="panel-title">${esc(calc.title)}</h3>
            <p class="panel-body">${esc(calc.description)}</p>
          </article>`
  );

  /* The newsroom teaser reads from the same snapshot the newsroom page uses,
     so the home page can never show stories the newsroom does not have. */
  const teaserItems = [
    ...articles.filter((a) => a.featured).slice(0, 1),
    ...news.items.filter((i) => i.type === 'external_news').slice(0, 2),
  ];

  const teaser = map(
    teaserItems,
    (record) => `          <article class="editorial-card">
            <a href="${attr(storyHref(record, lang))}"${storyLinkAttrs(record)}>
              ${storyImage(record, { placeholderAlt: t.ui.illustration })}
              <h3>${esc(record.title)}</h3>
              ${record.summary ? `<p>${esc(truncate(record.summary, 128))}</p>` : ''}
              ${storyMeta(record, lang, t)}
            </a>
          </article>`
  );

  return join([
    `    <section class="hero">
      <div class="hero-stage" data-hero-stage data-render-state="poster">
        <div class="hero-poster" role="img" aria-label="${attr(hero.posterAlt)}"
          style="--poster-wide:url('${attr(site.three.posterDesktop)}');--poster-mid:url('${attr(
            site.three.posterDesktopSmall
          )}');--poster-narrow:url('${attr(site.three.posterMobile)}')"></div>
        <canvas class="hero-canvas" data-hero-canvas aria-hidden="true"></canvas>
      </div>
      <div class="hero-scrim"></div>

      <div class="shell hero-inner">
        <div class="hero-text">
          <p class="marker">${esc(hero.label)}</p>
          <h1 class="hero-title">${esc(hero.titleLine1)}<span>${esc(hero.titleLine2)}</span></h1>
          <p class="hero-lead">${esc(hero.lead)}</p>

          <div class="btn-row hero-actions">
            <a class="btn btn--lg" href="${attr(href(lang, '/services/'))}">${esc(hero.ctaPrimary)}</a>
            <a class="btn btn--lg btn--ghost" href="${attr(href(lang, '/contact/'))}">${esc(
      hero.ctaSecondary
    )}</a>
          </div>

          <ul class="hero-rail" data-hero-rail>
${rail}
          </ul>

          <p class="hero-hint">${icons.arrowDown}<span>${esc(hero.scrollHint)}</span></p>
        </div>
      </div>
    </section>`,

    `    <section class="section section--ruled">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.home.diagnose.label)}</p>
          <h2 class="section-title">${esc(t.home.diagnose.title)}</h2>
          <p class="lead">${esc(t.home.diagnose.lead)}</p>
        </div>
        <div class="diagnose-grid">
${diagnose}
        </div>
      </div>
    </section>`,

    `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="grid">
          <div class="col-5">
            <div class="section-head">
              <p class="marker">${esc(t.home.approach.label)}</p>
              <h2 class="section-title">${esc(t.home.approach.title)}</h2>
              <p class="lead">${esc(t.home.approach.lead)}</p>
            </div>
            <a class="btn btn--ghost" href="${attr(href(lang, '/about/'))}">${esc(t.nav.about)}</a>
          </div>
          <div class="col-7">
            <ol class="steps">
${approach}
            </ol>
          </div>
        </div>
      </div>
    </section>`,

    `    <section class="section section--ruled">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.home.services.label)}</p>
          <h2 class="section-title">${esc(t.home.services.title)}</h2>
          <p class="lead">${esc(t.home.services.lead)}</p>
        </div>
        <div class="service-list">
${services}
        </div>
        <div class="btn-row" style="margin-block-start:var(--s-6)">
          <a class="btn" href="${attr(href(lang, '/services/'))}">${esc(t.home.services.viewAll)}</a>
        </div>
      </div>
    </section>`,

    `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="grid">
          <div class="col-5">
            <div class="section-head">
              <p class="marker">${esc(t.home.tools.label)}</p>
              <h2 class="section-title">${esc(t.home.tools.title)}</h2>
              <p class="lead">${esc(t.home.tools.lead)}</p>
            </div>
            <a class="btn" href="${attr(href(lang, '/tools/'))}">${esc(t.home.tools.viewAll)}</a>
          </div>
          <div class="col-7">
            <div class="grid" style="--s-6:var(--s-5)">
              <div class="col-12" style="display:grid;gap:var(--s-5);grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))">
${toolCards}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`,

    `    <section class="section section--dark">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.home.intelligence.label)}</p>
          <h2 class="section-title">${esc(t.home.intelligence.title)}</h2>
          <p class="lead">${esc(t.home.intelligence.lead)}</p>
        </div>
        <div class="editorial-grid">
${teaser}
        </div>
        <div class="btn-row" style="margin-block-start:var(--s-7)">
          <a class="btn btn--on-dark" href="${attr(href(lang, '/intelligence/'))}">${esc(
      t.home.intelligence.viewAll
    )}</a>
        </div>
      </div>
    </section>`,

    ctaBand({ site, lang, t }),
  ]);
}

/* ============================================================== SERVICES */

export function services({ site, lang, t }) {
  const details = map(
    t.services.items,
    (item) => `      <article class="service-detail" id="${attr(item.slug)}">
        <div class="service-detail-head">
          <div>
            <h2>${esc(item.title)}</h2>
            <ul class="flow" style="margin-block-start:var(--s-4)">${map(
              item.flow,
              (f) => `<li>${esc(f)}</li>`
            )}</ul>
            <ul class="chips" style="margin-block-start:var(--s-4)">${map(
              item.tools,
              (tool) => `<li class="chip">${esc(tool)}</li>`
            )}</ul>
          </div>
          <p class="lead">${esc(item.problem)}</p>
        </div>

        <div class="service-detail-body">
          <div>
            <h3 class="service-block-title">${esc(t.home.diagnose.label)}</h3>
            <p>${esc(item.diagnosis)}</p>
          </div>
          <div>
            <h3 class="service-block-title">${esc(t.home.approach.label)}</h3>
            <p>${esc(item.methodology)}</p>
          </div>
          <div>
            <h3 class="service-block-title">${esc(t.portfolio.labels.deliverables)}</h3>
            <ul class="list-marked">${map(item.deliverables, (d) => `<li>${esc(d)}</li>`)}</ul>
          </div>
        </div>
      </article>`
  );

  const capabilities = map(
    t.services.capability.groups,
    (group) => `          <article>
            <h3>${esc(group.title)}</h3>
            <p style="margin-block-start:var(--s-3)">${esc(group.description)}</p>
            <ul class="chips" style="margin-block-start:var(--s-4)">${map(
              group.tools,
              (tool) => `<li class="chip chip--ink">${esc(tool)}</li>`
            )}</ul>
          </article>`
  );

  const packages = map(
    t.services.engagement.packages,
    (pkg) => `          <article class="panel package">
            <h3>${esc(pkg.title)}</h3>
            <p class="package-note">${esc(pkg.note)}</p>
            <ul class="list-marked">${map(pkg.items, (item) => `<li>${esc(item)}</li>`)}</ul>
          </article>`
  );

  const steps = map(
    t.services.engagement.steps,
    (step) => `            <li>
              <div>
                <h3>${esc(step.title)}</h3>
                <p>${esc(step.description)}</p>
              </div>
            </li>`
  );

  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.services.hero.label)}</p>
        <h1 class="page-hero-title">${esc(t.services.hero.title)}</h1>
        <p class="lead">${esc(t.services.hero.lead)}</p>
      </div>
    </section>`,

    `    <section class="section">
      <div class="shell">
${details}
      </div>
    </section>`,

    `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.services.capability.label)}</p>
          <h2 class="section-title">${esc(t.services.capability.title)}</h2>
        </div>
        <div class="capability-grid">
${capabilities}
        </div>
      </div>
    </section>`,

    `    <section class="section section--ruled">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.services.engagement.label)}</p>
          <h2 class="section-title">${esc(t.services.engagement.title)}</h2>
          <p class="lead">${esc(t.services.engagement.lead)}</p>
        </div>
        <div class="package-grid">
${packages}
        </div>

        <div class="grid" style="margin-block-start:var(--s-9)">
          <div class="col-4">
            <h2 class="section-title">${esc(t.services.engagement.processTitle)}</h2>
          </div>
          <div class="col-8">
            <ol class="steps">
${steps}
            </ol>
          </div>
        </div>
      </div>
    </section>`,

    ctaBand({ site, lang, t }),
  ]);
}

/* ================================================================= TOOLS */

export function tools({ site, lang, t }) {
  const pillars = map(
    t.tools.growthCheck.pillars,
    (pillar) => `            <fieldset class="check-pillar" data-pillar="${attr(pillar.key)}"
              data-pillar-title="${attr(pillar.title)}"
              data-recommend="${attr(pillar.recommend)}"
              data-dont-yet="${attr(pillar.dontYet)}">
              <legend><h3>${esc(pillar.title)}</h3></legend>
${map(
  pillar.questions,
  (question, index) => `              <div class="scale-row">
                <label class="scale-q" for="${attr(pillar.key)}-${index}">${esc(question)}</label>
                <input type="range" id="${attr(pillar.key)}-${index}" name="${attr(
    pillar.key
  )}-${index}" min="1" max="5" step="1" value="3">
                <output class="scale-v" data-scale-value for="${attr(
                  pillar.key
                )}-${index}">3</output>
              </div>`
)}
            </fieldset>`
  );

  const calculators = map(
    t.tools.calculators,
    (calc) => `          <article class="tool">
            <h3>${esc(calc.title)}</h3>
            <p class="tool-desc">${esc(calc.description)}</p>
            <form data-calc="${attr(calc.key)}" novalidate>
${map(
  calc.fields,
  (field) => `              <div class="field">
                <label class="field-label" for="${attr(calc.key)}-${attr(field.key)}">${esc(
    field.label
  )}</label>
                <div class="field-unit">
                  <input class="input" type="text" inputmode="decimal" autocomplete="off"
                    id="${attr(calc.key)}-${attr(field.key)}" name="${attr(field.key)}" placeholder="0">
                  <span>${esc(field.unit)}</span>
                </div>
              </div>`
)}
              <div class="readout" data-readout data-state="empty">
                <span class="readout-value" data-readout-value>—</span>
                <span class="readout-label">${esc(calc.resultLabel)}</span>
              </div>
            </form>
            <p class="tool-note">${esc(calc.note)}</p>
          </article>`
  );

  const utmFields = map(
    t.tools.utm.fields,
    (field) => `            <div class="field">
              <label class="field-label" for="utm-${attr(field.key)}">${esc(field.label)}</label>
              <input class="input" type="${field.key === 'base' ? 'url' : 'text'}" autocomplete="off"
                id="utm-${attr(field.key)}" name="${attr(field.key)}" placeholder="${attr(
      field.placeholder
    )}">
            </div>`
  );

  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.tools.hero.label)}</p>
        <h1 class="page-hero-title">${esc(t.tools.hero.title)}</h1>
        <p class="lead">${esc(t.tools.hero.lead)}</p>
      </div>
    </section>

    <div data-tools>`,

    `    <section class="section">
      <div class="shell">
        <div class="check-grid">
          <form data-check novalidate>
            <div class="section-head">
              <p class="marker">${esc(t.tools.hero.label)}</p>
              <h2 class="section-title">${esc(t.tools.growthCheck.title)}</h2>
              <p class="lead">${esc(t.tools.growthCheck.description)}</p>
              <p class="field-hint">${esc(t.tools.growthCheck.scaleHint)}</p>
            </div>

${pillars}

            <div class="btn-row" style="margin-block-start:var(--s-7)">
              <button type="submit" class="btn btn--lg">${esc(t.tools.growthCheck.submit)}</button>
              <button type="reset" class="btn btn--ghost">${esc(t.tools.growthCheck.reset)}</button>
            </div>

            <div class="check-result" data-check-result hidden tabindex="-1">
              <h3>${esc(t.tools.growthCheck.resultTitle)}</h3>
              <div class="meter" data-check-labels style="margin-block-start:var(--s-5)"></div>

              <div class="check-finding" style="margin-block-start:var(--s-6)">
                <p class="aside-title">${esc(t.tools.growthCheck.weakest)}</p>
                <strong data-fill="weakest"></strong>
                <p data-fill="recommend" style="margin-block-start:var(--s-2)"></p>
              </div>
              <div class="check-finding">
                <p class="aside-title">${esc(t.tools.growthCheck.dontYet)}</p>
                <p data-fill="dontYet"></p>
              </div>
              <div class="check-finding">
                <p class="aside-title">${esc(t.tools.growthCheck.strongest)}</p>
                <strong data-fill="strongest"></strong>
              </div>

              <div class="btn-row" style="margin-block-start:var(--s-6)">
                <a class="btn" href="${attr(href(lang, '/contact/'))}">${esc(t.home.cta.cta)}</a>
              </div>
            </div>
          </form>

          <aside>
            <div class="notice">${icons.info}<span>${esc(t.tools.privacyNote)}</span></div>
            <div class="panel panel--tinted" style="margin-block-start:var(--s-6)">
              <h3 class="panel-title">${esc(t.services.engagement.processTitle)}</h3>
              <ol class="steps" style="margin-block-start:var(--s-4)">
${map(
  t.services.engagement.steps,
  (step) => `                <li><div><h3>${esc(step.title)}</h3></div></li>`
)}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </section>`,

    `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="section-head section-head--wide">
          <p class="marker">${esc(t.tools.hero.label)}</p>
          <h2 class="section-title">${esc(t.tools.hero.title)}</h2>
          <p class="lead">${esc(t.tools.privacyNote)}</p>
        </div>
        <div class="tool-grid">
${calculators}
        </div>
      </div>
    </section>`,

    `    <section class="section section--ruled">
      <div class="shell">
        <div class="grid">
          <div class="col-4">
            <div class="section-head">
              <p class="marker">${esc(t.tools.hero.label)}</p>
              <h2 class="section-title">${esc(t.tools.utm.title)}</h2>
              <p class="lead">${esc(t.tools.utm.description)}</p>
            </div>
            <p>${esc(t.tools.utm.note)}</p>
          </div>
          <div class="col-8">
            <form data-utm novalidate>
              <div class="form-grid">
${utmFields}
              </div>
              <div class="utm-out">
                <output data-utm-output aria-live="polite">—</output>
                <button type="button" class="btn btn--ghost" data-copy="[data-utm-output]"
                  data-label-copy="${attr(t.ui.copy)}" data-label-copied="${attr(t.ui.copied)}">${esc(
      t.ui.copy
    )}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>

    </div>`,

    ctaBand({ site, lang, t }),
  ]);
}

/* ================================================================= ABOUT */

export function about({ site, lang, t }) {
  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.about.hero.label)}</p>
        <h1 class="page-hero-title">${esc(t.about.hero.title)}</h1>
        <p class="lead">${esc(t.about.hero.lead)}</p>
      </div>
    </section>`,

    `    <section class="section">
      <div class="shell about-grid">
        <div class="prose">
${map(t.about.body, (paragraph) => `          <p>${esc(paragraph)}</p>`)}
        </div>
        <aside>
          <h2 class="aside-title">${esc(t.about.factsTitle)}</h2>
          <dl class="facts">
${map(
  t.about.facts,
  (fact) => `            <div><dt>${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd></div>`
)}
          </dl>
          <div class="btn-row" style="margin-block-start:var(--s-6)">
            <a class="btn" href="${attr(href(lang, '/contact/'))}">${esc(t.ui.primaryCta)}</a>
          </div>
        </aside>
      </div>
    </section>`,

    `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="section-head">
          <p class="marker">${esc(t.about.principles.title)}</p>
          <h2 class="section-title">${esc(t.home.approach.title)}</h2>
        </div>
        <ul class="principle-list">
${map(
  t.about.principles.items,
  (item) => `          <li>
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.description)}</p>
          </li>`
)}
        </ul>
      </div>
    </section>`,

    ctaBand({ site, lang, t }),
  ]);
}

/* =============================================================== CONTACT */

export function contact({ site, lang, t }) {
  const field = ({ id, name, label, type = 'text', required, autocomplete, hint }) => `            <div class="field${
    hint ? '' : ''
  }">
              <label class="field-label" for="${attr(id)}">${esc(label)}${
    required ? '' : `<span class="field-opt">${esc(t.ui.optional)}</span>`
  }</label>
              <input class="input" type="${attr(type)}" id="${attr(id)}" name="${attr(name)}"${
    autocomplete ? ` autocomplete="${attr(autocomplete)}"` : ''
  }${required ? ' data-required required' : ''}>
              ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ''}
              <p class="field-error" aria-live="polite"></p>
            </div>`;

  const select = ({ id, name, label, options }) => `            <div class="field">
              <label class="field-label" for="${attr(id)}">${esc(label)}<span class="field-opt">${esc(
    t.ui.optional
  )}</span></label>
              <select class="select" id="${attr(id)}" name="${attr(name)}">
                <option value="">${esc(t.contact.form.select)}</option>
${map(options, (option) => `                <option value="${attr(option)}">${esc(option)}</option>`)}
              </select>
            </div>`;

  const formStrings = {
    ...t.contact.states,
    sending: t.contact.form.sending,
    submit: t.contact.form.submit,
  };

  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.contact.hero.label)}</p>
        <h1 class="page-hero-title">${esc(t.contact.hero.title)}</h1>
        <p class="lead">${esc(t.contact.hero.lead)}</p>
      </div>
    </section>`,

    `    <section class="section">
      <div class="shell contact-grid">
        <form data-contact-form novalidate
          data-endpoint="${attr(site.contact.formEndpoint || '')}"
          data-strings="${jsonAttr(formStrings)}">
          <div class="form-grid">
${field({ id: 'c-name', name: 'name', label: t.contact.form.name, required: true, autocomplete: 'name' })}
${field({ id: 'c-company', name: 'company', label: t.contact.form.company, autocomplete: 'organization' })}
${field({ id: 'c-email', name: 'email', label: t.contact.form.email, type: 'email', required: true, autocomplete: 'email' })}
${field({ id: 'c-phone', name: 'phone', label: t.contact.form.phone, type: 'tel', autocomplete: 'tel' })}
${select({ id: 'c-need', name: 'need', label: t.contact.form.need, options: t.contact.form.needOptions })}
${select({ id: 'c-budget', name: 'budget', label: t.contact.form.budget, options: t.contact.form.budgetOptions })}
${select({ id: 'c-timeline', name: 'timeline', label: t.contact.form.timeline, options: t.contact.form.timelineOptions })}
            <div class="field field--full">
              <label class="field-label" for="c-problem">${esc(t.contact.form.problem)}</label>
              <textarea class="textarea" id="c-problem" name="problem" data-required required></textarea>
              <p class="field-hint">${esc(t.contact.form.problemHint)}</p>
              <p class="field-error" aria-live="polite"></p>
            </div>
          </div>

          <div class="btn-row" style="margin-block-start:var(--s-6)">
            <button type="submit" class="btn btn--lg">${esc(t.contact.form.submit)}</button>
          </div>

          <div class="notice form-status" data-form-status hidden></div>
        </form>

        <aside>
          <h2 class="aside-title">${esc(t.contact.directTitle)}</h2>
          <ul class="channel-list">
            <li>
              <p class="channel-label">${esc(t.contact.channels.email)}</p>
              <p class="channel-value"><a href="mailto:${attr(site.contact.email)}">${esc(
      site.contact.email
    )}</a></p>
            </li>
            <li>
              <p class="channel-label">${esc(t.contact.channels.phone)}</p>
              <p class="channel-value"><a href="tel:${attr(site.contact.phone)}">${esc(
      site.contact.phoneDisplay
    )}</a></p>
            </li>
            <li>
              <p class="channel-label">${esc(t.contact.channels.zalo)}</p>
              <p class="channel-value"><a href="${attr(
                site.contact.zalo
              )}" rel="noopener">${esc(site.contact.phoneDisplay)}</a></p>
            </li>
            <li>
              <p class="channel-label">${esc(t.contact.channels.location)}</p>
              <p class="channel-value">${esc(site.contact.location.city)}, ${esc(
      site.contact.location.country
    )}</p>
            </li>
          </ul>

          <div class="zalo-qr">
            ${figure({
              src: site.contact.zaloQr,
              alt: `${t.contact.channels.zalo} ${site.contact.phoneDisplay}`,
              ratio: '1x1',
              sizes: '152px',
            })}
          </div>
        </aside>
      </div>
    </section>`,
  ]);
}

/* ========================================================== INTELLIGENCE */

export function intelligence({ site, lang, t, articles, news }) {
  const external = news.items.filter((i) => i.type === 'external_news');
  const lead = external[0] || articles[0];
  const supports = external.slice(1, 4);
  const latest = external.slice(4, 14);

  const byCategory = (slug, limit) =>
    external.filter((i) => (i.categorySlugs || []).includes(slug)).slice(0, limit);

  const briefings = articles.filter((a) => a.type === 'briefing').slice(0, 3);
  const analysis = articles.filter((a) => a.type !== 'briefing').slice(0, 6);

  const supportRows = map(
    supports,
    (record) => `          <article class="story-row">
            <a href="${attr(storyHref(record, lang))}"${storyLinkAttrs(record)}>
              ${storyImage(record, { ratio: '4x3', placeholderAlt: t.ui.illustration })}
              <div>
                <h3>${esc(record.title)}</h3>
                ${storyMeta(record, lang, t)}
              </div>
            </a>
          </article>`
  );

  const streamRows = map(
    latest,
    (record) => `          <li>
            <article class="story-row">
              <a href="${attr(storyHref(record, lang))}"${storyLinkAttrs(record)}>
                ${storyImage(record, { ratio: '4x3', placeholderAlt: t.ui.illustration })}
                <div>
                  <h3>${esc(record.title)}</h3>
                  ${storyMeta(record, lang, t)}
                </div>
              </a>
            </article>
          </li>`
  );

  const topicBlock = (slug, title) => {
    const items = byCategory(slug, 6);
    if (!items.length) return '';
    const [first, ...rest] = items;
    return `      <section class="section section--tight section--ruled">
        <div class="shell">
          <div class="section-head">
            <p class="marker">${esc(title)}</p>
          </div>
          <div class="topic-block">
            <article class="story-lead">
              <a href="${attr(storyHref(first, lang))}"${storyLinkAttrs(first)}>
                ${storyImage(first, { placeholderAlt: t.ui.illustration })}
                <h2 style="font-size:var(--fs-h3)">${esc(first.title)}</h2>
                ${storyMeta(first, lang, t)}
              </a>
            </article>
            <ul class="headline-list">
${map(
  rest,
  (record) => `              <li>
                <a href="${attr(storyHref(record, lang))}"${storyLinkAttrs(record)}>
                  <h3>${esc(record.title)}</h3>
                  ${storyMeta(record, lang, t)}
                </a>
              </li>`
)}
            </ul>
          </div>
        </div>
      </section>`;
  };

  const editorialCards = (list) =>
    map(
      list,
      (article) => `            <article class="editorial-card">
              <a href="${attr(href(lang, article.localPath))}">
                ${figure({
                  src: article.cover,
                  alt: article.title,
                  ratio: '16x9',
                })}
                <h3>${esc(article.title)}</h3>
                <p>${esc(truncate(article.summary, 136))}</p>
                ${storyMeta(article, lang, t)}
              </a>
            </article>`
    );

  const typeFilters = ['all', 'external_news', 'briefing', 'analysis', 'playbook'];
  const categoryFilters = [
    'all',
    ...site.newsroom.categories.map((c) => c.slug),
    ...site.newsroom.articleCategories.map((c) => c.slug),
  ];

  const archiveStrings = {
    types: t.intelligence.types,
    unknownDate: t.ui.unknownDate,
    results: t.ui.results,
    loadMore: t.ui.loadMore,
    illustration: t.ui.illustration,
    errorTitle: t.ui.retry,
    errorBody: t.ui.staleNotice,
  };

  return join([
    `    <section class="page-hero page-hero--news">
      <div class="shell page-hero-inner">
        <div>
          <p class="marker">${esc(t.intelligence.hero.label)}</p>
          <h1 class="page-hero-title">${esc(t.intelligence.hero.title)}</h1>
        </div>
        <div>
          <p class="lead">${esc(t.intelligence.hero.lead)}</p>
          <p class="sync-bar" data-sync-static>
            <span class="sync-dot"></span>
            <span>${esc(t.ui.synced)} ${esc(formatDate(news.snapshotUpdatedAt, lang) || '—')}</span>
            <a href="${attr(href(lang, '/intelligence/source-policy/'))}">${esc(
      t.nav.sourcePolicy
    )}</a>
          </p>
        </div>
      </div>
    </section>`,

    lead
      ? `    <section class="section section--tight">
      <div class="shell">
        <div class="lead-block">
          <article class="story-lead">
            <a href="${attr(storyHref(lead, lang))}"${storyLinkAttrs(lead)}>
              ${storyImage(lead, { eager: true, placeholderAlt: t.ui.illustration })}
              <h2>${esc(lead.title)}</h2>
              ${storyMeta(lead, lang, t)}
              ${lead.summary ? `<p>${esc(truncate(lead.summary, 220))}</p>` : ''}
            </a>
          </article>
          <div class="lead-supports">
${supportRows}
          </div>
        </div>
      </div>
    </section>`
      : '',

    latest.length
      ? `    <section class="section section--tight section--ruled">
      <div class="shell">
        <div class="section-head">
          <p class="marker">${esc(t.intelligence.sections.latest)}</p>
        </div>
        <ul class="stream">
${streamRows}
        </ul>
      </div>
    </section>`
      : '',

    topicBlock('ai-platforms', t.intelligence.sections.aiPlatforms),
    topicBlock('advertising', t.intelligence.sections.advertising),
    topicBlock('ecommerce', t.intelligence.sections.ecommerce),
    topicBlock('business-market', t.intelligence.sections.businessMarket),

    briefings.length
      ? `    <section class="section section--tint section--ruled">
        <div class="shell">
          <div class="section-head">
            <p class="marker">${esc(t.intelligence.sections.briefings)}</p>
            <p class="lead">${esc(t.intelligence.ownNotice)}</p>
          </div>
          <div class="editorial-grid">
${editorialCards(briefings)}
          </div>
        </div>
      </section>`
      : '',

    analysis.length
      ? `    <section class="section section--ruled">
        <div class="shell">
          <div class="section-head">
            <p class="marker">${esc(t.intelligence.sections.analysis)}</p>
          </div>
          <div class="editorial-grid">
${editorialCards(analysis)}
          </div>
        </div>
      </section>`
      : '',

    `    <section class="section section--tint section--ruled" data-newsroom
      data-source="/data/news.json"
      data-page-size="${attr(site.newsroom.pageSize)}"
      data-strings="${jsonAttr(archiveStrings)}">
      <div class="shell">
        <div class="section-head">
          <p class="marker">${esc(t.intelligence.sections.browse)}</p>
        </div>

        <div class="filters">
          <div class="filter-search">
            ${icons.search}
            <label class="u-visually-hidden" for="news-search">${esc(t.ui.search)}</label>
            <input class="input" type="search" id="news-search" data-search
              placeholder="${attr(t.ui.searchPlaceholder)}" autocomplete="off">
          </div>

          <div class="filter-group" data-filter-group="type" role="group"
            aria-label="${attr(t.intelligence.sections.browse)}">
${map(
  typeFilters,
  (value) => `            <button type="button" class="filter-chip" data-value="${attr(value)}"
              aria-pressed="${value === 'all' ? 'true' : 'false'}">${esc(
    value === 'all' ? t.ui.all : t.intelligence.types[value]
  )}</button>`
)}
          </div>
        </div>

        <div class="filter-group" data-filter-group="category" role="group"
          aria-label="${attr(t.intelligence.sections.browse)}" style="margin-block-start:var(--s-4)">
${map(
  categoryFilters,
  (value) => `          <button type="button" class="filter-chip" data-value="${attr(value)}"
            aria-pressed="${value === 'all' ? 'true' : 'false'}">${esc(
    value === 'all' ? t.ui.all : t.intelligence.categories[value] || value
  )}</button>`
)}
        </div>

        <div class="results-head">
          <p class="results-count" data-results-count aria-live="polite"></p>
          <p class="sync-bar" data-sync hidden>
            <span class="sync-dot"></span>
            <span>${esc(t.ui.synced)} <span data-sync-time></span></span>
          </p>
          <button type="button" class="btn btn--quiet" data-clear>${esc(t.ui.clear)}</button>
        </div>

        <div class="results-grid" data-results></div>

        <div class="empty-state" data-empty hidden>
          <h3 data-empty-title>${esc(t.ui.noResults)}</h3>
          <p data-empty-body>${esc(t.ui.noResultsHint)}</p>
          <button type="button" class="btn btn--ghost" data-retry hidden>${esc(t.ui.retry)}</button>
        </div>

        <div class="pager">
          <button type="button" class="btn btn--ghost" data-load-more hidden>${esc(
            t.ui.loadMore
          )}</button>
        </div>
      </div>
    </section>`,
  ]);
}

/* ========================================================= SOURCE POLICY */

export function sourcePolicy({ site, lang, t }) {
  const policy = t.intelligence.sourcePolicy;
  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.intelligence.hero.label)}</p>
        <h1 class="page-hero-title">${esc(policy.title)}</h1>
        <p class="lead">${esc(policy.lead)}</p>
      </div>
    </section>`,

    `    <section class="section">
      <div class="shell">
        <div class="prose">
${map(
  policy.sections,
  (section) => `          <h2>${esc(section.title)}</h2>
          <p>${esc(section.body)}</p>`
)}
        </div>
        <div class="btn-row" style="margin-block-start:var(--s-8)">
          <a class="btn btn--ghost" href="${attr(href(lang, '/intelligence/'))}">${esc(
      t.article.backToIndex
    )}</a>
        </div>
      </div>
    </section>`,
  ]);
}

/* =============================================================== ARTICLE */

export function article({ site, lang, t, article: record, body, next, related }) {
  const { html, headings } = withHeadingIds(body.body);

  const toc = headings.filter((h) => h.level === 2);

  const sources = record.sources || [];

  return join([
    `    <article>
      <header class="article-head">
        <div class="shell">
          <a class="article-back" href="${attr(href(lang, '/intelligence/'))}">${icons.arrowLeft}<span>${esc(
      t.article.backToIndex
    )}</span></a>

          <ul class="chips" style="margin-block-end:var(--s-4)">
            <li class="chip chip--cobalt">${esc(t.intelligence.types[record.type])}</li>
            <li class="chip">${esc(t.intelligence.categories[record.category] || record.category)}</li>
          </ul>
          <h1 class="article-title">${esc(body.title)}</h1>
          <p class="article-summary">${esc(body.summary)}</p>

          <dl class="article-byline">
            <div><dt>${esc(t.ui.author)}</dt><dd>${esc(record.author)}</dd></div>
            <div><dt>${esc(t.ui.published)}</dt><dd>${
              formatDate(record.publishedAt, lang) || esc(t.ui.unknownDate)
            }</dd></div>
            ${
              record.updatedAt && record.updatedAt !== record.publishedAt
                ? `<div><dt>${esc(t.ui.updated)}</dt><dd>${formatDate(
                    record.updatedAt,
                    lang
                  )}</dd></div>`
                : ''
            }
            ${
              record.readMinutes
                ? `<div><dd>${esc(record.readMinutes)} ${esc(t.ui.readMinutes)}</dd></div>`
                : ''
            }
          </dl>

          ${
            record.cover
              ? `<div class="article-cover">
            ${figure({ src: record.cover, alt: body.title, eager: true })}
            <p class="media-credit">${esc(record.coverCredit)}</p>
          </div>`
              : ''
          }
        </div>
      </header>

      <div class="shell">
        <div class="article-body-grid">
          <div>
            <div class="prose">
${html}
            </div>

            ${
              body.evidenceNote
                ? `<aside class="evidence">
              <p class="aside-title">${esc(t.article.evidenceNote)}</p>
              <p>${esc(body.evidenceNote)}</p>
            </aside>`
                : ''
            }
          </div>

          <aside class="article-aside">
            ${
              body.takeaways && body.takeaways.length
                ? `<div class="aside-block takeaways">
              <p class="aside-title">${esc(t.ui.takeaways)}</p>
              <ul>${map(body.takeaways, (item) => `<li>${esc(item)}</li>`)}</ul>
            </div>`
                : ''
            }

            ${
              toc.length > 1
                ? `<div class="aside-block">
              <p class="aside-title">${esc(t.article.inThisArticle)}</p>
              <ul class="toc" data-toc>
${map(toc, (h) => `                <li><a href="#${attr(h.id)}">${esc(h.text)}</a></li>`)}
              </ul>
            </div>`
                : ''
            }

            ${
              sources.length
                ? `<div class="aside-block">
              <p class="aside-title">${esc(t.ui.sources)}</p>
              <ul class="sources-list">
${map(
  sources,
  (source) => `                <li>
                  <a href="${attr(source.url)}" target="_blank" rel="noopener nofollow">${esc(
    source.title
  )}</a>
                  <span class="sources-host">${esc(new URL(source.url).hostname.replace(/^www\./, ''))}</span>
                </li>`
)}
              </ul>
            </div>`
                : ''
            }
          </aside>
        </div>
      </div>
    </article>`,

    next
      ? `    <section class="shell">
      <a class="article-next" href="${attr(href(lang, articlePath(next.article)))}">
        <p class="marker">${esc(t.ui.nextArticle)}</p>
        <h2>${esc(next.title)}</h2>
      </a>
    </section>`
      : '',

    related && related.length
      ? `    <section class="section section--tint section--ruled">
      <div class="shell">
        <div class="section-head">
          <p class="marker">${esc(t.ui.relatedReading)}</p>
        </div>
        <div class="editorial-grid">
${map(
  related,
  (item) => `          <article class="editorial-card">
            <a href="${attr(href(lang, articlePath(item.article)))}">
              ${figure({ src: item.article.cover, alt: item.title })}
              <h3>${esc(item.title)}</h3>
              <p>${esc(truncate(item.summary, 120))}</p>
            </a>
          </article>`
)}
        </div>
      </div>
    </section>`
      : '',

    ctaBand({ site, lang, t }),
  ]);
}

/* ============================================================= PORTFOLIO */

export function portfolioIndex({ site, lang, t, cases }) {
  return join([
    `    <section class="page-hero">
      <div class="shell">
        <p class="marker">${esc(t.portfolio.hero.label)}</p>
        <h1 class="page-hero-title">${esc(t.portfolio.hero.title)}</h1>
        <p class="lead">${esc(t.portfolio.hero.lead)}</p>
        <div class="notice" style="margin-block-start:var(--s-6);max-width:var(--measure)">${
          icons.info
        }<span>${esc(t.portfolio.notListed)}</span></div>
      </div>
    </section>`,

    `    <section class="section">
      <div class="shell">
${map(
  cases,
  (item) => `        <article class="case" id="${attr(item.slug)}">
          <div class="case-head">
            <div>
              <h2>${esc(item.body.title)}</h2>
              <ul class="chips" style="margin-block-start:var(--s-4)">
                <li class="chip chip--ink">${esc(item.body.industry)}</li>
                <li class="chip">${esc(item.year)}</li>
              </ul>
            </div>
            <p class="lead">${esc(item.body.context)}</p>
          </div>

          <div class="case-body">
            <div>
              <h3 class="service-block-title">${esc(t.portfolio.labels.problem)}</h3>
              <p>${esc(item.body.problem)}</p>
            </div>
            <div>
              <h3 class="service-block-title">${esc(t.portfolio.labels.approach)}</h3>
              <p>${esc(item.body.approach)}</p>
            </div>
            <div>
              <h3 class="service-block-title">${esc(t.portfolio.labels.deliverables)}</h3>
              <ul class="list-marked">${map(
                item.body.deliverables,
                (d) => `<li>${esc(d)}</li>`
              )}</ul>
            </div>
          </div>

          <div class="case-gallery">
${map(
  item.images,
  (image) =>
    `            ${figure({ src: image, alt: item.body.title, ratio: '4x3' })}`
)}
          </div>
        </article>`
)}
      </div>
    </section>`,
  ]);
}

/* ================================================================== 404 */

export function notFound({ site, lang, t }) {
  const links = [
    { key: 'home', path: '/' },
    ...site.navigation,
    { key: 'contact', path: '/contact/' },
  ];
  return `    <section class="shell notfound">
      <h1>${esc(t.notFound.title)}</h1>
      <p class="lead">${esc(t.notFound.lead)}</p>
      <div class="notfound-links">
${map(
  links,
  (item) =>
    `        <a class="btn btn--ghost" href="${attr(href(lang, item.path))}">${esc(
      t.nav[item.key]
    )}</a>`
)}
      </div>
    </section>`;
}
