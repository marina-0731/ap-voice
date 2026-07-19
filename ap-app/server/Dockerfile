FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
EXPOSE 3001
CMD ["node", "index.js"]
