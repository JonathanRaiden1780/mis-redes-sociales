# Especificación Técnica: Social Media Content Engine

## Objetivo

Motor de contenido para redes sociales que transforma ideas simples en publicaciones optimizadas mediante IA, con generación de contenido visual y difusión multi-plataforma.

## Alcance

### In Scope
- [x] Amplificación de prompts con IA (parser, intención, builder, adapter)
- [x] Generación de imágenes/video con Agnes Video Generator
- [x] Persistencia SQLite (campañas, contenido generado, historial de difusiones)
- [x] Difusión manual sin APIs externas (6 plataformas)
- [x] Integración WhatsApp Business API (Twilio)
- [x] Publicación multi-plataforma (Instagram, TikTok, Facebook)
- [x] Historial de campañas con CRUD completo
- [x] Configuración centralizada de API keys
- [x] Fallback inteligente cuando APIs no disponibles
- [x] Tests unitarios y de integración (45 tests)

### Out of Scope
- [ ] Aplicación móvil nativa
- [ ] Scheduler de publicaciones (futuro)
- [ ] Analytics/métricas de engagement (futuro)
- [ ] Integración con CRM externo

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Dashboard   │  │  Historial  │  │ Configuración│            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │         AmplifyPanel + ResultPanel               │           │
│  │      PlatformGrid + ManualDiffusion              │           │
│  │           WhatsAppPanel + History                 │           │
│  └────────────────────────┬────────────────────────┘           │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────┼─────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│  ┌────────────────────────┴────────────────────────┐           │
│  │                  API Routers                     │           │
│  │  /api/amplify  /api/campaigns  /api/generate    │           │
│  │  /api/diffuse  /api/whatsapp   /api/publish    │           │
│  └────────────────────────┬────────────────────────┘           │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │                Core Services                     │           │
│  │  Amplifier    ContentGen    SocialClients       │           │
│  │  Parser       AgnesClient   WhatsAppBot         │           │
│  │  Intent       Fallback      Instagram           │           │
│  │  Builder                      TikTok           │           │
│  │  Adapter                       Facebook         │           │
│  └────────────────────────┬────────────────────────┘           │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │              Database (SQLite)                   │           │
│  │  Campaign  GeneratedContent  DiffusionHistory   │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Prompt Amplifier (`src/server/core/amplifier/`)
- **parser.py**: Extrae entidades (producto, precio, oferta, urgencia, emoción)
- **intent_analyzer.py**: Clasifica intención de venta, triggers psicológicos, CTA
- **prompt_builder.py**: Construye prompts estructurados con estilo y paleta de colores
- **platform_adapter.py**: Adapta prompts por plataforma (IG, TikTok, FB, WhatsApp)

### 2. Content Generator (`src/server/core/content_generator.py`)
- Integración con Agnes Video Generator API
- Fallback inteligente cuando Agnes no disponible
- Soporte para imágenes y videos

### 3. Social Clients (`src/server/core/social_clients/`)
- **InstagramClient**: Meta Graph API (stories, posts)
- **TikTokClient**: TikTok Content Posting API
- **FacebookClient**: Facebook Graph API
- **WhatsAppDiffusionBot**: Twilio WhatsApp Business API

### 4. Database (`src.server.database/`)
- **Campaign**: Campañas con metadata completa
- **GeneratedContent**: Contenido generado (imágenes/videos)
- **DiffusionHistory**: Historial de mensajes enviados

### 5. API Routers (`src.server.api/`)
- **campaigns.py**: CRUD campañas
- **generate.py**: Generación de contenido
- **diffuse.py**: Difusión manual
- **whatsapp.py**: WhatsApp Twilio
- **publish.py**: Publicación multi-plataforma

## Mejores Prácticas

1. **Fallback primero**: Todas las APIs externas deben tener modo degradado
2. **Tests obligatorios**: Cada endpoint debe tener tests pytest
3. **Sin secrets en código**: API keys solo en variables de entorno
4. **Persistencia local**: SQLite como default, PostgreSQL opcional
5. **pnpm only**: Nunca npm/yarn/bun
6. **Sin Co-authored-by**: Commits limpios

## Decisiones Arquitectónicas

### ADR-001: SQLite sobre PostgreSQL
**Contexto**: ¿Qué base de datos usar para el MVP?
**Decisión**: SQLite por simplicidad y zero-config
**Razón**: El volumen de datos es bajo (<10k campañas), no hay concurrencia crítica, y permite deploy sin infraestructura adicional
**Consecuencias**: + Fácil deploy, - No escalable a millones de registros

### ADR-002: Fallback inteligente
**Contexto**: ¿Qué pasa cuando las APIs externas no están disponibles?
**Decisión**: Modo fallback automático con mensaje informativo
**Razón**: El sistema debe funcionar siempre, aunque sea con funcionalidad reducida
**Consecuencias**: + Always-on, - Funcionalidad limitada sin APIs

### ADR-003: Estilos inline en React
**Contexto**: ¿Cómo manejar estilos en el frontend?
**Decisión**: CSS inline via `style={{}}` en lugar de Tailwind CSS
**Razón**: Evita problemas de compilación con Tailwind v4 y simplifica el build
**Consecuencias**: + Sin dependencias CSS, - Menos reutilización de clases