# The static Gobia Panel demo: builds the panel frontend and the Gobia extensions with the demo's mock API, then serves
# the files with nginx and nothing else (no PHP, no backend, no outbound connections).
# Build from the repository root:  docker build -f demo/Dockerfile -t gobiadactyl-demo .
# (demo/Dockerfile.dockerignore replaces the root .dockerignore, which leaves out the extensions.)
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY extensions/gobia-theme/package.json extensions/gobia-theme/package-lock.json extensions/gobia-theme/
COPY extensions/gobia-files/package.json extensions/gobia-files/package-lock.json extensions/gobia-files/
RUN npm --prefix extensions/gobia-theme ci --no-audit --no-fund --ignore-scripts \
    && npm --prefix extensions/gobia-files ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN node demo/build.mjs

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Slovenian time for the logs (POSIX rule, so no tzdata is needed).
ENV TZ=CET-1CEST,M3.5.0,M10.5.0/3
COPY demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY demo/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /src/demo/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1
