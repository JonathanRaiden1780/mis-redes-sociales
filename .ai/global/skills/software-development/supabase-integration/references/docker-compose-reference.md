# Docker Compose Reference for Supabase Stack

## Full docker-compose.yml

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - supabase-api
    networks:
      - finanzeasy

  supabase-db:
    image: supabase/postgres:15.1.0.117
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-postgres}
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - finanzeasy

  supabase-api:
    image: supabase/gotrue:v2.151.0
    ports:
      - "8000:8000"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 8000
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD:-postgres}@supabase-db:5432/postgres?sslmode=disable
      GOTRUE_JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_SITE_URL: ${SITE_URL:-http://localhost}
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-http://localhost/auth/callback}
    depends_on:
      supabase-db:
        condition: service_healthy
    networks:
      - finanzeasy

  supabase-rest:
    image: supabase/postgrest:v12.0.1
    ports:
      - "3000:3000"
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD:-postgres}@supabase-db:5432/postgres
      PGRST_DB_SCHEMA: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token}
    depends_on:
      supabase-db:
        condition: service_healthy
    networks:
      - finanzeasy

  supabase-realtime:
    image: supabase/realtime:v2.28.32
    ports:
      - "4000:4000"
    environment:
      DB_HOST: supabase-db
      DB_PORT: 5432
      DB_NAME: postgres
      DB_USER: postgres
      DB_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      DB_SSL: "false"
      SECURE_CHANNELS: "true"
      JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token}
      REALTIME_IP_VERSION: "IPv4"
    depends_on:
      supabase-db:
        condition: service_healthy
    networks:
      - finanzeasy

  backup:
    image: supabase/postgres:15.1.0.117
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - ./backups:/backups
      - ./scripts:/scripts
    entrypoint: /scripts/backup-entrypoint.sh
    depends_on:
      supabase-db:
        condition: service_healthy
    networks:
      - finanzeasy
    profiles:
      - backup

volumes:
  supabase-db-data:

networks:
  finanzeasy:
    driver: bridge
```

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| frontend | 80 | Nginx static serving |
| supabase-db | 5432 | PostgreSQL |
| supabase-api | 8000 | Auth API (GoTrue) |
| supabase-rest | 3000 | REST API (PostgREST) |
| supabase-realtime | 4000 | WebSockets |

## Commands

```bash
# Start all services
docker compose up -d

# Start without backup service
docker compose up -d frontend supabase-db supabase-api supabase-rest supabase-realtime

# Run backup manually
docker compose --profile backup run backup

# View logs
docker compose logs -f supabase-db

# Stop all
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```

## Environment Variables

Create a `.env` file:

```env
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=postgres
JWT_SECRET=your-jwt-secret-min-32-chars
SITE_URL=http://localhost
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost/auth/callback
```

## Healthchecks

The database service includes a healthcheck that runs `pg_isready` every 10 seconds. Other services use `condition: service_healthy` to wait for the database to be ready before starting.
