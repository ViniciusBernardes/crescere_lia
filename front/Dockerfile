FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_USE_AI_CHAT=true
ARG VITE_SHOW_JOURNEYS=true
ENV VITE_USE_AI_CHAT=$VITE_USE_AI_CHAT
ENV VITE_SHOW_JOURNEYS=$VITE_SHOW_JOURNEYS

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
