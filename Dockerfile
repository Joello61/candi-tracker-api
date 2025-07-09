# Étape 1 : builder
FROM node:22-alpine AS builder

WORKDIR /app

# Copier package.json et package-lock.json (ou yarn.lock)
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code source
COPY . .

# Générer Prisma client et compiler TypeScript
RUN npx prisma generate
RUN npm run build

# Étape 2 : production
FROM node:22-alpine

WORKDIR /app

# Copier les fichiers buildés depuis l’étape builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Variables d'environnement sont injectées par CapRover (donc pas ici)

EXPOSE 3001

CMD ["node", "dist/server.js"]
