# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Market Manager - A comprehensive platform for crafters to manage inventory, calculate costs, and organize sales operations. This is a monorepo containing both backend (NestJS) and frontend (Next.js) applications.

- This app is called Market Manager

## Architecture

**Monorepo Structure:**
- `backend/` - NestJS API with TypeScript, PostgreSQL, Prisma ORM, Redis
- `frontend/` - Next.js 14+ App Router with React and TypeScript
- `shared/` - Common types, utilities, and configurations

**Key Technologies:**
- Backend: NestJS, PostgreSQL, Prisma, Redis, Stripe integration
- Frontend: Next.js 15.4.4, React 19.1.0, TypeScript, Zustand, TanStack Query, Zod
- Infrastructure: DigitalOcean, Docker, DigitalOcean Spaces
- Integrations: Shopify, Square, Etsy APIs

## Core Features

- Inventory management (materials, components, supplies)
- Cost calculation (labor tracking, material costs, manufacturing costs)
- Sales & market management (product catalog, market sheets)
- CSV export for Shopify, Square, and other inventory systems
- Stripe payment processing

## Development Commands

**Docker Development:**
- `npm run docker:dev:up` - Start development environment with hot reload
- `npm run docker:dev:down` - Stop development environment
- `npm run docker:dev:migrate` - Run database migrations
- `npm run docker:dev:seed` - Seed development database
- `npm run docker:dev:rebuild` - Rebuild all containers
- `npm run docker:dev:rebuild:backend` - Rebuild only backend
- `npm run docker:dev:rebuild:frontend` - Rebuild only frontend
- `npm run docker:dev:tools` - Start pgAdmin and Redis Commander

**Docker Production:**
- `npm run docker:prod:up` - Start production environment
- `npm run docker:prod:down` - Stop production environment
- `npm run docker:prod:migrate` - Run production migrations
- `npm run docker:prod:rebuild` - Rebuild production containers

*See `docs/implementation/Docker Setup Guide.md` for complete workflow details.*

## Database

- Uses PostgreSQL with Prisma ORM
- Redis for caching and record locking
- Migrations managed through Prisma

## Authentication

- Authentication system to be implemented
- User management and session handling

## Deployment

- Target deployment: DigitalOcean App Platform
- Docker containerization
- CI/CD pipeline for automated deployments
- DigitalOcean Spaces for image storage

## Implementation Status

**✅ Completed Foundation:**
- Docker development/production environments with hot reload
- Next.js 15.4.4 + React 19.1.0 frontend with modern dependencies
- NestJS backend with Prisma ORM and PostgreSQL
- Zustand stores for state management
- TanStack Query for server state
- Zod validation schemas
- Complete project structure and tooling

**🚧 Next Phase - Core Features:**
- Product management CRUD operations
- Materials inventory system
- Cost calculation engine
- Market management and CSV exports
- API endpoint implementation

*See `docs/implementation/Implementation Status.md` for detailed progress tracking.*

## Documentation

**Architecture:** `docs/architecture/` - High-level system design and decisions
**Implementation:** `docs/implementation/` - Current status, setup guides, and workflows
**Quick Start:** See `docs/implementation/Docker Setup Guide.md`

## Git Workflow

- Always sign commits