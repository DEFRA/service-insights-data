import nunjucks from 'nunjucks'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// POC frontend rendering. Loader roots: govuk-frontend + @defra/frontend
// components/templates, and this app's own views. Rendered directly to HTML
// strings in the route handlers (no @hapi/vision needed).
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

export const govukDist = join(repoRoot, 'node_modules', 'govuk-frontend', 'dist')
export const defraSrc = join(repoRoot, 'node_modules', '@defra', 'frontend', 'src')
export const publicDir = join(repoRoot, 'public')
const viewsDir = join(here, 'views')

export const env = nunjucks.configure([govukDist, defraSrc, viewsDir], {
  autoescape: true,
  noCache: true
})

// Cache-busts the stylesheets on each restart.
env.addGlobal('assetVersion', String(Date.now()))
