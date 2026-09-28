# Builds the frontend and serves it with nginx.
FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Vite embeds VITE_* variables into the bundle at build time.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
  || (echo "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are empty - fill in .env" && exit 1)
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
