FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/proxy/package.json ./apps/proxy/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./package.json
COPY apps/proxy/package.json ./apps/proxy/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/proxy/dist ./apps/proxy/dist
COPY --from=build /app/apps/web/dist ./apps/proxy/public
EXPOSE 8080
CMD ["node", "apps/proxy/dist/server.js"]