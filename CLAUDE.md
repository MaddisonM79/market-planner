# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Yarn Crafting SaaS - A comprehensive platform for yarn crafters to manage inventory, calculate costs, and organize sales operations. This is a monorepo containing both backend (NestJS) and frontend (Next.js) applications.

## Architecture

**Monorepo Structure:**
- `backend/` - NestJS API with TypeScript, PostgreSQL, Prisma ORM, Redis
- `frontend/` - Next.js 14+ App Router with React and TypeScript
- `shared/` - Common types, utilities, and configurations

**Key Technologies:**
- Backend: NestJS, PostgreSQL, Prisma, Redis, Stripe integration
- Frontend: Next.js 14+, React, TypeScript, Clerk authentication
- Infrastructure: DigitalOcean, Docker, DigitalOcean Spaces
- Integrations: Shopify, Square, Etsy APIs

## Core Features

- Inventory management (yarn, components, materials)
- Cost calculation (labor tracking, material costs, manufacturing costs)
- Sales & market management (product catalog, market sheets)
- CSV export for Shopify, Square, and other inventory systems
- Stripe payment processing

## Development Commands

*Note: Commands will be added as the project structure is established*

## Database

- Uses PostgreSQL with Prisma ORM
- Redis for caching and record locking
- Migrations managed through Prisma

## Authentication

- Clerk for user management, MFA, and social logins
- Enterprise-ready security features

## Deployment

- Target deployment: DigitalOcean App Platform
- Docker containerization
- CI/CD pipeline for automated deployments
- DigitalOcean Spaces for image storage