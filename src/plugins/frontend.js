import Inert from '@hapi/inert'
import { join } from 'node:path'

import { frontendRoutes } from '#/frontend/routes.js'
import { govukDist, publicDir } from '#/frontend/nunjucks.js'

// POC frontend: serves the Defra-branded reader UI over the directory read-model
// from the same Hapi server as the data API. For production this would be a
// separate CDP frontend service (cdp-node-frontend-template) — see README.
export const frontend = {
  plugin: {
    name: 'frontend',
    register: async (server) => {
      await server.register(Inert)

      // Static assets: govuk-frontend CSS/JS/fonts/images, plus our stylesheets.
      server.route([
        {
          method: 'GET',
          path: '/govuk/{param*}',
          handler: { directory: { path: join(govukDist, 'govuk') } }
        },
        {
          method: 'GET',
          path: '/assets/{param*}',
          handler: { directory: { path: join(govukDist, 'govuk', 'assets') } }
        },
        { method: 'GET', path: '/app.css', handler: { file: join(publicDir, 'app.css') } },
        { method: 'GET', path: '/defra-frontend.css', handler: { file: join(publicDir, 'defra-frontend.css') } }
      ])

      server.route(frontendRoutes)
    }
  }
}
