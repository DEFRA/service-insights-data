// Read-only data access for the directory read-model in MongoDB. Each function
// takes the Hapi `db` handle and returns plain data; the frontend routes shape
// it into view context. Matches the CDP services/ pattern.

function searchRegex(q) {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

export async function listServices(db, { q = '', dg = '' } = {}) {
  const filter = {}
  if (dg) filter['deliveryGroup.slug'] = dg
  if (q) {
    const rx = searchRegex(q)
    filter.$or = [
      { userFacingName: rx },
      { internalName: rx },
      { provider: rx }
    ]
  }
  const [services, groups, totalCount] = await Promise.all([
    db
      .collection('services')
      .find(filter)
      .collation({ locale: 'en' })
      .sort({ userFacingName: 1, internalName: 1 })
      .toArray(),
    db.collection('deliveryGroup').find().sort({ name: 1 }).toArray(),
    db.collection('services').countDocuments()
  ])
  return { services, groups, totalCount }
}

export async function getServiceDetail(db, slug) {
  const doc = await db.collection('services').findOne({ slug })
  if (!doc) return null

  const [needs, outcomes, userGroups, webEntries, relatedDocs] =
    await Promise.all([
      doc.userNeedIds?.length
        ? db
            .collection('userNeed')
            .find({ _id: { $in: doc.userNeedIds } })
            .toArray()
        : [],
      doc.outcomeIds?.length
        ? db
            .collection('defraOutcome')
            .find({ _id: { $in: doc.outcomeIds } })
            .toArray()
        : [],
      doc.userGroupIds?.length
        ? db
            .collection('userGroup')
            .find({ _id: { $in: doc.userGroupIds } })
            .toArray()
        : [],
      db
        .collection('webRegisterEntry')
        .find({ serviceId: doc.legacyId })
        .toArray(),
      doc.relationships?.length
        ? db
            .collection('services')
            .find({
              _id: {
                $in: doc.relationships.map((r) => r.targetId).filter(Boolean)
              }
            })
            .toArray()
        : []
    ])
  return { doc, needs, outcomes, userGroups, webEntries, relatedDocs }
}

export async function listWebRegister(db, { q = '', link = '' } = {}) {
  const filter = {}
  if (link === 'linked') filter.serviceId = { $ne: null }
  if (link === 'unlinked') filter.serviceId = null
  if (q) {
    const rx = searchRegex(q)
    filter.$or = [
      { summary: rx },
      { issueKey: rx },
      { department: rx },
      { status: rx }
    ]
  }
  const [entries, totalCount, linkedCount] = await Promise.all([
    db
      .collection('webRegisterEntry')
      .find(filter)
      .collation({ locale: 'en' })
      .sort({ summary: 1 })
      .toArray(),
    db.collection('webRegisterEntry').countDocuments(),
    db
      .collection('webRegisterEntry')
      .countDocuments({ serviceId: { $ne: null } })
  ])
  const ids = entries.map((e) => e.serviceId).filter(Boolean)
  const services = ids.length
    ? await db
        .collection('services')
        .find({ legacyId: { $in: ids } })
        .toArray()
    : []
  return { entries, services, totalCount, linkedCount }
}

export async function getWebRegisterEntry(db, id) {
  const e = await db.collection('webRegisterEntry').findOne({ legacyId: id })
  if (!e) return null
  const svc = e.serviceId
    ? await db.collection('services').findOne({ legacyId: e.serviceId })
    : null
  return { e, svc }
}
