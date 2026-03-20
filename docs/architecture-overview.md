# Platform Architecture Overview

The Cap Applications Platform is built using a layered architecture designed for modular growth and long-term scalability.

## Architecture Layers

Users  
↓  
Web Application (Next.js hosted on Vercel)  
↓  
Operational Modules  
↓  
Shared Platform Services  
↓  
Integration Layer  
↓  
Data Access Layer  
↓  
PostgreSQL Database  
↓  
Reporting / Analytics

## Infrastructure Model

Application Hosting
- Vercel

Database
- PostgreSQL hosted internally

File Storage
- Amazon S3

This hybrid architecture allows the application layer to scale independently while maintaining control over core operational data.

## Operational Modules

Modules represent functional business areas.

Examples:

- CMMS (Maintenance)
- Recuts
- Production
- QC
- Embroidery
- Emblem
- Laser
- Inventory (future)
- Warehouse (future)

Each module manages its own operational data while referencing shared services.

## Shared Platform Services

Platform services provide reusable capabilities used across modules.

Examples:

Activity History  
Tracks record level activity across the system.

Comments / Notes  
Allows users to add contextual notes to records.

Attachments  
File storage and document association using Amazon S3.

Voiding
Void or soft delete entries

Notifications (future)

Workflow Engine (future)

## Integration Layer

External systems may connect through this layer.

Examples:

- ERP / Sales Orders
- Machine telemetry
- Reporting platforms
- Warehouse systems
- File storage services

## Data Access Layer

The data layer uses repository patterns to isolate database logic from API routes.

Benefits:

- maintainable code
- reusable queries
- centralized data logic