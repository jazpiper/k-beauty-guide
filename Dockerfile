FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true
ENV GENERATE_SOURCEMAP=false
ENV WDS_SOCKET_PORT=0

COPY package.json package-lock.json ./
RUN npm install -g npm@11
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "build"]
