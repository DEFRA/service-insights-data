// Seed the directory read-model into MongoDB from the bundled NDJSON snapshot.
//
// The data is a point-in-time export of the six collections the reader uses
// (extended JSON, so ObjectIds and dates round-trip). It carries no personal
// data — staff identities live in `appUser`, which the UI never touches and
// this seed never includes.
//
// Idempotent: each collection is dropped and reloaded, so re-running yields a
// clean state. Run with `npm run seed` (reads MONGO_URI / MONGO_DATABASE).
import { MongoClient } from 'mongodb'
import { EJSON } from 'bson'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import process from 'node:process'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data')

// Indexes per collection — mirrors the read-model's access patterns.
const INDEXES = {
  services: [
    { key: { slug: 1 }, options: { unique: true, name: 'slug_unique' } },
    {
      key: { legacyId: 1 },
      options: { unique: true, name: 'legacyId_unique' }
    },
    {
      key: { 'deliveryGroup.slug': 1 },
      options: { name: 'deliveryGroup_slug' }
    },
    { key: { 'status.name': 1 }, options: { name: 'status_name' } },
    { key: { userNeedIds: 1 }, options: { name: 'userNeedIds' } },
    { key: { outcomeIds: 1 }, options: { name: 'outcomeIds' } }
  ],
  deliveryGroup: [
    {
      key: { legacyId: 1 },
      options: { unique: true, name: 'legacyId_unique' }
    },
    { key: { slug: 1 }, options: { unique: true, name: 'slug_unique' } }
  ],
  userNeed: [
    { key: { legacyId: 1 }, options: { unique: true, name: 'legacyId_unique' } }
  ],
  defraOutcome: [
    { key: { legacyId: 1 }, options: { unique: true, name: 'legacyId_unique' } }
  ],
  userGroup: [
    { key: { legacyId: 1 }, options: { unique: true, name: 'legacyId_unique' } }
  ],
  webRegisterEntry: [
    {
      key: { legacyId: 1 },
      options: { unique: true, name: 'legacyId_unique' }
    },
    { key: { serviceId: 1 }, options: { name: 'serviceId' } }
  ]
}

const COLLECTIONS = Object.keys(INDEXES)

function readCollection(name) {
  const text = readFileSync(join(dataDir, `${name}.ndjson`), 'utf8')
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => EJSON.parse(line))
}

async function main() {
  const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/'
  const databaseName = process.env.MONGO_DATABASE || 'service-insights-data'

  const client = await MongoClient.connect(mongoUrl)
  const db = client.db(databaseName)
  console.log(`Seeding ${databaseName}`)

  try {
    for (const name of COLLECTIONS) {
      const docs = readCollection(name)
      await db
        .collection(name)
        .drop()
        .catch((err) => {
          if (err.codeName !== 'NamespaceNotFound') throw err
        })
      const collection = db.collection(name)
      await collection.createIndexes(
        INDEXES[name].map((i) => ({ key: i.key, ...i.options }))
      )
      if (docs.length) await collection.insertMany(docs, { ordered: false })
      const count = await collection.countDocuments()
      console.log(`  ${name.padEnd(20)} ${count}`)
    }
    console.log('Seed complete.')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
