FROM node:20-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --immutable

COPY . .
RUN yarn build

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

CMD ["node", "dist/index.js"]
