FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY server ./server
COPY web ./web
COPY db ./db
COPY docs ./docs
COPY README.md ./README.md

EXPOSE 3000

CMD ["npm", "start"]
