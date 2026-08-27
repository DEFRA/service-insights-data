import { env } from './nunjucks.js'
import { esc, richText, nameOf, statusTagClass } from './format.js'
import {
  listServices,
  getServiceDetail,
  listWebRegister,
  getWebRegisterEntry
} from '#/services/directory.js'

const html = (h, body) => h.response(body).type('text/html')

// ── Services list ────────────────────────────────────────────────────────────
async function renderList(db, query) {
  const q = (query.q || '').trim()
  const dg = (query.dg || '').trim()
  const { services, groups, totalCount } = await listServices(db, { q, dg })

  const dgItems = [{ value: '', text: 'All delivery groups' }].concat(
    groups.map((g) => ({
      value: g.slug,
      text: g.name,
      selected: g.slug === dg
    }))
  )

  const rows = services.map((s) => {
    const flag = s.userFacingName
      ? ''
      : '<span class="app-internal-flag">Internal name</span>'
    const status = s.status?.name
      ? `<strong class="govuk-tag ${statusTagClass(s.status.name)}">${esc(s.status.name)}</strong>`
      : ''
    return [
      {
        html: `<a class="govuk-link" href="/service/${esc(s.slug)}">${esc(nameOf(s))}</a>${flag}`
      },
      { text: s.deliveryGroup?.name || '' },
      { text: s.provider || '' },
      { html: status }
    ]
  })

  return env.render('list.njk', {
    q,
    rows,
    dgItems,
    shownCount: services.length,
    totalCount,
    filtered: Boolean(q || dg)
  })
}

// ── Service detail ───────────────────────────────────────────────────────────
async function renderDetail(db, slug) {
  const result = await getServiceDetail(db, slug)
  if (!result) return null
  const { doc, needs, outcomes, userGroups, webEntries, relatedDocs } = result
  const byId = new Map(relatedDocs.map((r) => [String(r._id), r]))

  const s = {
    name: nameOf(doc),
    userFacingName: doc.userFacingName,
    status: doc.status || {},
    statusTagClass: statusTagClass(doc.status?.name),
    deliveryGroup: doc.deliveryGroup || {},
    description: doc.description,
    techOverviewHtml: richText(doc.techOverview),
    legislationHtml: richText(doc.legislation),
    notesHtml: richText(doc.notes),
    enables: (doc.enables || []).filter(Boolean),
    dataDependencies: (doc.dataDependencies || []).filter(Boolean)
  }

  const link = (url) =>
    url
      ? {
          html: `<a class="govuk-link" href="${esc(url)}" rel="noopener noreferrer">${esc(url)}</a>`
        }
      : null
  const text = (v) => (v ? { text: v } : null)
  const summaryRows = [
    ['Lead organisation', text(doc.provider)],
    ['Supporting organisations', text(doc.deliveryPartner)],
    ['Delivery group', text(doc.deliveryGroup?.name)],
    ['Programme', text(doc.programme?.name)],
    ['Type', text(doc.type?.name)],
    ['Channel', text(doc.channel?.name)],
    ['Security classification', text(doc.sensitivity?.name)],
    ['Lifecycle phase', text(doc.deliveryPhase?.name)],
    ['Progress status', text(doc.progressStatus?.name)],
    ['Volume of users', text(doc.volume)],
    ['Transaction volume', text(doc.transactionVolume)],
    ['Service URL', link(doc.url)],
    ['Online guidance', link(doc.onlineGuidance)]
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => ({ key: { text: key }, value }))

  const related = (doc.relationships || []).map((r) => {
    const t = byId.get(String(r.targetId))
    return {
      slug: t?.slug,
      name: t ? nameOf(t) : '(unknown service)',
      type: r.type
    }
  })

  return env.render('detail.njk', {
    s,
    summaryRows,
    userNeeds: needs.map((n) => n.needText || n.role).filter(Boolean),
    outcomes: outcomes.map((o) => o.name).filter(Boolean),
    userGroups: userGroups.map((g) => g.name).filter(Boolean),
    related,
    webEntries: webEntries.map((w) => ({
      id: w.legacyId,
      summary: w.summary || w.issueKey,
      status: w.status
    }))
  })
}

// ── Web register list ────────────────────────────────────────────────────────
async function renderWebRegister(db, query) {
  const q = (query.q || '').trim()
  const link = (query.link || '').trim()
  const { entries, services, totalCount, linkedCount } = await listWebRegister(
    db,
    { q, link }
  )
  const byLegacyId = new Map(services.map((s) => [s.legacyId, s]))

  const linkItems = [
    { value: '', text: 'All entries' },
    {
      value: 'linked',
      text: 'Matched to a service',
      selected: link === 'linked'
    },
    { value: 'unlinked', text: 'Not matched', selected: link === 'unlinked' }
  ]

  const rows = entries.map((e) => {
    const svc = e.serviceId ? byLegacyId.get(e.serviceId) : null
    const matched = svc
      ? `<a class="govuk-link" href="/service/${esc(svc.slug)}">${esc(nameOf(svc))}</a>`
      : '<span class="govuk-hint govuk-!-margin-0">—</span>'
    return [
      {
        html: `<a class="govuk-link" href="/web-register/${e.legacyId}">${esc(e.summary || e.issueKey || '(no summary)')}</a>`
      },
      { text: e.issueType || '' },
      { text: e.status || '' },
      { html: matched }
    ]
  })

  return env.render('web-register.njk', {
    q,
    rows,
    linkItems,
    shownCount: entries.length,
    totalCount,
    linkedCount,
    filtered: Boolean(q || link)
  })
}

// ── Web register entry detail ────────────────────────────────────────────────
async function renderWebRegisterEntry(db, id) {
  const result = await getWebRegisterEntry(db, id)
  if (!result) return null
  const { e, svc } = result

  const link = (url) =>
    url
      ? {
          html: `<a class="govuk-link" href="${esc(url)}" rel="noopener noreferrer">${esc(url)}</a>`
        }
      : null
  const text = (v) => (v ? { text: v } : null)

  const detailRows = [
    ['Issue key', text(e.issueKey)],
    ['Type', text(e.issueType)],
    ['Status', text(e.status)],
    ['Department', text(e.department)],
    [
      'Matched service',
      svc
        ? {
            html: `<a class="govuk-link" href="/service/${esc(svc.slug)}">${esc(nameOf(svc))}</a>`
          }
        : null
    ],
    ['External service', link(e.linkExternalService)],
    ['GOV.UK page', link(e.linkGovUk)],
    ['Internal service', link(e.linkInternalService)]
  ]
    .filter(([, v]) => v)
    .map(([key, value]) => ({ key: { text: key }, value }))

  const a11yRows = [
    ['Audited by', text(e.a11yAuditBy)],
    ['Audit type', text(e.a11yAuditType)],
    ['Progress', text(e.a11yProgress)],
    ['Claimed standard', text(e.a11yClaimedStandard)],
    ['Assessed compliance', text(e.a11yAssessedCompliance)],
    ['Disproportionate burden', text(e.a11yDisproportionateBurden)],
    ['Accessibility statement', text(e.a11yStatementPresent)],
    ['Statement URL', link(e.a11yStatementUrl)],
    [
      'Last reviewed',
      e.a11yLastReviewedAt
        ? { text: new Date(e.a11yLastReviewedAt).toISOString().slice(0, 10) }
        : null
    ]
  ]
    .filter(([, v]) => v)
    .map(([key, value]) => ({ key: { text: key }, value }))

  return env.render('web-register-entry.njk', {
    e: {
      name: e.summary || e.issueKey || '(no summary)',
      descriptionHtml: richText(e.description),
      status: e.status
    },
    detailRows,
    a11yRows
  })
}

export const frontendRoutes = [
  {
    method: 'GET',
    path: '/',
    handler: async (request, h) =>
      html(h, await renderList(request.db, request.query))
  },
  {
    method: 'GET',
    path: '/service/{slug}',
    handler: async (request, h) => {
      const body = await renderDetail(request.db, request.params.slug)
      return body
        ? html(h, body)
        : h
            .response(env.render('not-found.njk', {}))
            .type('text/html')
            .code(404)
    }
  },
  {
    method: 'GET',
    path: '/web-register',
    handler: async (request, h) =>
      html(h, await renderWebRegister(request.db, request.query))
  },
  {
    method: 'GET',
    path: '/web-register/{id}',
    handler: async (request, h) => {
      const id = Number(request.params.id)
      const body = Number.isInteger(id)
        ? await renderWebRegisterEntry(request.db, id)
        : null
      return body
        ? html(h, body)
        : h
            .response(env.render('not-found.njk', {}))
            .type('text/html')
            .code(404)
    }
  }
]
