# Development Standards

These standards ensure consistency across the platform.

## Code Organization

Prefer:

Route → Service → Repository → Database

Avoid placing complex logic inside route handlers.

## Hosting Model

Application runtime:

- Next.js hosted on Vercel

API execution:

- Vercel serverless functions

Database:

- PostgreSQL hosted internally

File storage:

- Amazon S3

## Naming Conventions

Tables

module_entity

Examples

cmms_work_orders  
recut_requests  
production_entries  

Columns

snake_case

Example

created_at  
updated_at  
status  

## Reusable Components

Whenever possible use shared components.

Examples

DataTable  
Sidebar panels  
Buttons  
Form controls  

## Role Based Security

All APIs should validate user roles.

Typical roles:

ADMIN  
MANAGER  
SUPERVISOR  
TECH  
OPERATOR 
CUSTOMER SERVICE 
PURCHASING
SALES
USER

## Styling Standards

Prefer global CSS for shared styles.

Avoid excessive inline styling.