FROM node:20-alpine

WORKDIR /app

# Bind to all interfaces inside container
ENV HOSTNAME=0.0.0.0 \
    PORT=3000

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]
