import Boom from '@hapi/boom'

import {
  listServices,
  getServiceDetail,
  listWebRegister,
  getWebRegisterEntry
} from '#/services/directory.js'

// JSON API over the directory read-model, consumed by the frontend service.
// Returns the data the reader needs; presentation (markup, formatting) is the
// frontend's concern.
export const api = [
  {
    method: 'GET',
    path: '/api/services',
    handler: async (request, h) => {
      const { q, dg } = request.query
      return h.response(await listServices(request.db, { q, dg }))
    }
  },
  {
    method: 'GET',
    path: '/api/services/{slug}',
    handler: async (request, h) => {
      const result = await getServiceDetail(request.db, request.params.slug)
      if (!result) {
        return Boom.notFound()
      }
      return h.response(result)
    }
  },
  {
    method: 'GET',
    path: '/api/web-register',
    handler: async (request, h) => {
      const { q, link } = request.query
      return h.response(await listWebRegister(request.db, { q, link }))
    }
  },
  {
    method: 'GET',
    path: '/api/web-register/{id}',
    handler: async (request, h) => {
      const id = Number(request.params.id)
      const result = Number.isInteger(id)
        ? await getWebRegisterEntry(request.db, id)
        : null
      if (!result) {
        return Boom.notFound()
      }
      return h.response(result)
    }
  }
]
