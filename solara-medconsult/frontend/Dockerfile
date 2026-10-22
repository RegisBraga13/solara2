FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

# Dentro do container o servidor precisa escutar em 0.0.0.0; o compose publica a porta só em 127.0.0.1.
CMD ["npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]
