import { seedDatabase } from '#/seed/seed.js'

// POC data-load: on boot, if the read-model is empty, load the bundled snapshot
// into Mongo. This runs inside the service container — which has both the seed
// files and the authenticated DB connection — because the CDP terminal is a
// separate tooling container that can't run the seed script.
//
// Safe: it only acts on an empty database (checks `services`) and never
// overwrites existing data. For production, data would be loaded deliberately
// rather than on startup — see the README.
export const seedOnStartup = {
  plugin: {
    name: 'seed-on-startup',
    register: async (server) => {
      const existing = await server.db.collection('services').countDocuments()
      if (existing > 0) {
        server.logger.info(
          `Seed skipped: services already has ${existing} documents`
        )
        return
      }
      server.logger.info(
        'Empty read-model detected — seeding from the bundled snapshot'
      )
      const report = await seedDatabase(server.db)
      server.logger.info({ seed: report }, 'Seed complete')
    }
  }
}
