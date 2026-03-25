# Cap Applications Platform

The Cap Applications Platform is an internal manufacturing and operations system designed to support production tracking, maintenance management, operational workflows, and reporting across the organization.

The system is being developed as a modular platform where shared services support multiple operational modules.

## Core Objectives

• Provide a unified operational platform  
• Replace manual spreadsheets and fragmented tools  
• Improve operational visibility and reporting  
• Standardize workflows across departments  
• Enable automation and AI-assisted decision making  

## Technology Stack

Frontend
- Next.js
- React
- TypeScript
- Tailwind / Global CSS

Backend
- Next.js API routes
- Repository / service pattern

Hosting
- Vercel

Database
- PostgreSQL (internal VM)

File Storage
- Amazon S3

Future integrations may include:

- ERP / Sales Order integration
- Machine telemetry
- Warehouse systems
- Reporting platforms
- Workflow automation

## Platform Design Philosophy

The system follows several guiding principles:

- Modular architecture
- Shared platform services
- Reusable UI components
- Centralized reporting layer
- Consistent development standards
- Cloud-hosted application layer
- Scalable file storage architecture

## Primary Platform Services

Shared services are used across modules:

- Activity History
- Comments / Notes
- Attachments
- Notifications (future)
- Workflow Events (future)

Modules reference these services rather than recreating functionality.

## Infrastructure Overview

Application Layer  
Hosted on Vercel for scalable frontend and API execution.

Database Layer  
PostgreSQL hosted on an internal Windows VM.

Storage Layer  
File attachments stored in Amazon S3 to support scalable storage and long-term document retention.
## Test