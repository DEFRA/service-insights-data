ARG PARENT_VERSION=3.0.5-node24.14.1
ARG PORT=3000
ARG PORT_DEBUG=9229

FROM defradigital/node-development:${PARENT_VERSION} AS development
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node-development:${PARENT_VERSION}

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

COPY --chown=node:node package*.json ./
# vendor/ holds the @defra/frontend tarball referenced as a file: dependency,
# so it must be present before install. public/ holds the prebuilt stylesheets.
COPY --chown=node:node vendor ./vendor
RUN npm install
COPY --chown=node:node ./src ./src
COPY --chown=node:node ./public ./public

CMD [ "npm", "run", "docker:dev" ]

FROM defradigital/node:${PARENT_VERSION} AS production
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node:${PARENT_VERSION}

# Add curl to template.
# CDP PLATFORM HEALTHCHECK REQUIREMENT
USER root
RUN apk add --no-cache curl
USER node

COPY --from=development /home/node/package*.json ./
COPY --from=development /home/node/vendor ./vendor
RUN npm ci --omit=dev
COPY --from=development /home/node/src ./src/
COPY --from=development /home/node/public ./public/

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD [ "node", "src" ]
