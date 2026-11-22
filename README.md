
# WEBRO Management System

### Business Operations & Management Platform

A centralized, full-stack business management platform designed to streamline client relationships, sales operations, project delivery, employee management, financial tracking, and business analytics.

Built with a modular REST API architecture using Node.js, Express.js, MongoDB, and modern JavaScript.

> **Development Status:** Backend API modules implemented. Database integration, end-to-end testing, and frontend dashboard development are in progress.

---

## Overview

WEBRO Management System brings essential business operations into a single platform.

The system is designed to help organizations manage the complete workflow from lead acquisition and client onboarding to project execution, employee coordination, payment tracking, and business reporting.

### Key Objectives

- Centralize business information.
- Streamline sales and client management.
- Improve project visibility.
- Organize employee responsibilities.
- Track invoices and payments.
- Support data-driven business decisions.
- Establish secure, role-based access.

---

## Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript runtime |
| Express.js | REST API framework |
| MongoDB | Document database |
| Mongoose | Database modeling |
| JavaScript (ES Modules) | Application development |
| JWT | Authentication |
| bcryptjs | Password hashing and verification |
| Zod | Request validation |
| Helmet | HTTP security headers |
| CORS | Cross-origin request configuration |
| express-rate-limit | API rate limiting |
| cookie-parser | Cookie handling |
| Nodemon | Development server |

### Frontend

The frontend dashboard is planned as a separate application.

Frontend implementation and integration are pending.

### Development Tools

- Visual Studio Code
- Git & GitHub
- npm
- Postman
- MongoDB Compass / Atlas

---

## Core Modules

### 1. Authentication & Authorization

Authentication infrastructure for secure access to the management platform.

**Implemented in code:**

- JWT-based authentication
- HttpOnly authentication cookies
- Role-based authorization
- Login and logout endpoints
- Current-user endpoint
- CSRF token generation and validation
- Password hashing verification
- Request validation
- Login rate limiting

**User Roles:**

| Role | Intended Access |
|------|-----------------|
| Admin | Administrative management |
| Manager | Business operations and team management |
| Employee | Assigned operational activities |

Role restrictions must be verified through integration testing before production deployment.

### 2. Client Management

Centralized management of business clients.

**Features:**

- Create client records
- View client information
- Update client details
- Manage client status
- Track associated projects
- Maintain contact information
- Track contract and payment information

### 3. Lead Management

Manage potential customers throughout the sales pipeline.

**Features:**

- Lead registration
- Lead status tracking
- Lead priority management
- Lead assignment
- Follow-up scheduling
- Lead conversion workflows
- Sales pipeline monitoring

### 4. Call Management

Record and organize business communication.

**Features:**

- Incoming and outgoing call records
- Lead and client associations
- Call outcomes
- Call duration tracking
- Communication history
- Follow-up information

### 5. Follow-up Management

Organize scheduled business interactions.

**Features:**

- Create follow-up activities
- Assign responsible employees
- Set priorities
- Schedule follow-up dates
- Track pending activities
- Mark follow-ups completed
- Maintain activity history

### 6. Project Management

Manage client projects from planning to delivery.

**Features:**

- Project creation and updates
- Client-project associations
- Project status management
- Team assignment
- Milestone tracking
- Deadline management
- Project budget tracking
- Progress monitoring
- Repository and live URL management

### 7. Task Management

Coordinate daily work across projects.

**Features:**

- Task creation
- Task assignment
- Task priorities
- Task status tracking
- Project-linked tasks
- Checklists
- Deadline management
- Task progress monitoring

### 8. Employee Management

Maintain employee information and organizational records.

**Features:**

- Employee profiles
- Employee ID generation
- Department management
- Designation management
- Employment status tracking
- Reporting relationships
- Work mode management
- Joining and exit information
- Salary information with restricted access

### 9. Payment Management

Track client payments and financial transactions.

**Features:**

- Payment records
- Payment status management
- Payment verification
- Payment method tracking
- Client and project associations
- Refund workflows
- Payment statistics

Financial reconciliation and transactional behavior require database integration testing.

### 10. Invoice Management

Manage client billing information.

**Features:**

- Invoice creation
- Invoice number generation
- Invoice line items
- Invoice status management
- Payment allocation
- Outstanding balance tracking
- Invoice statistics

Tax compliance and financial calculations must be validated before production use.

### 11. Dashboard Analytics

REST endpoints for business performance reporting.

**Planned dashboard metrics include:**

- Business overview
- Revenue analytics
- Lead analytics
- Project analytics
- Task analytics
- Employee analytics
- Recent business activity

Analytics accuracy will be verified after database integration.

---

## Project Architecture

```text
webro-management/
|
|-- backend/
|   |
|   |-- src/
|   |   |
|   |   |-- config/
|   |   |   |-- db.js
|   |   |   `-- env.js
|   |   |
|   |   |-- controllers/
|   |   |   |-- authController.js
|   |   |   |-- clientController.js
|   |   |   |-- leadController.js
|   |   |   |-- callController.js
|   |   |   |-- followUpController.js
|   |   |   |-- projectController.js
|   |   |   |-- paymentController.js
|   |   |   |-- invoiceController.js
|   |   |   |-- taskController.js
|   |   |   |-- employeeController.js
|   |   |   `-- dashboardController.js
|   |   |
|   |   |-- middlewares/
|   |   |   |-- authMiddleware.js
|   |   |   |-- csrfMiddleware.js
|   |   |   |-- errorMiddleware.js
|   |   |   |-- validate.js
|   |   |   `-- validateRequest.js
|   |   |
|   |   |-- models/
|   |   |   |-- User.js
|   |   |   |-- Client.js
|   |   |   |-- Lead.js
|   |   |   |-- Call.js
|   |   |   |-- FollowUp.js
|   |   |   |-- Project.js
|   |   |   |-- Payment.js
|   |   |   |-- PaymentRefund.js
|   |   |   |-- Invoice.js
|   |   |   |-- InvoiceCounter.js
|   |   |   |-- InvoicePaymentAllocation.js
|   |   |   |-- Task.js
|   |   |   |-- Employee.js
|   |   |   `-- EmployeeCounter.js
|   |   |
|   |   |-- routes/
|   |   |   |-- authRoutes.js
|   |   |   |-- clientRoutes.js
|   |   |   |-- leadRoutes.js
|   |   |   |-- callRoutes.js
|   |   |   |-- followUpRoutes.js
|   |   |   |-- projectRoutes.js
|   |   |   |-- paymentRoutes.js
|   |   |   |-- invoiceRoutes.js
|   |   |   |-- taskRoutes.js
|   |   |   |-- employeeRoutes.js
|   |   |   `-- dashboardRoutes.js
|   |   |
|   |   |-- validators/
|   |   |   |-- authValidator.js
|   |   |   |-- clientValidator.js
|   |   |   |-- leadValidator.js
|   |   |   |-- callValidator.js
|   |   |   |-- followUpValidator.js
|   |   |   |-- projectValidator.js
|   |   |   |-- paymentValidator.js
|   |   |   |-- invoiceValidator.js
|   |   |   |-- taskValidator.js
|   |   |   `-- employeeValidator.js
|   |   |
|   |   |-- scripts/
|   |   |   `-- createAdmin.js
|   |   |
|   |   |-- app.js
|   |   `-- server.js
|   |
|   |-- .env.example
|   |-- .gitignore
|   `-- package.json
|
|-- frontend/
|
|-- .gitignore
`-- README.md
```

---

## Backend Architecture

The backend follows a modular, controller-based architecture.

```text
HTTP Request
     |
     v
Express Application
     |
     v
Security Middleware
     |
     v
Authentication / Authorization
     |
     v
Request Validation
     |
     v
API Router
     |
     v
Controller
     |
     v
Mongoose Model
     |
     v
MongoDB
     |
     v
JSON Response
```

### Architecture Principles

- Separation of concerns
- Modular routing
- Centralized error handling
- Request validation
- Role-based access control
- Reusable middleware
- Database schema modeling
- Consistent REST API design

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- Git
- MongoDB (required for database-backed endpoints)

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/webro-management.git
cd webro-management
```

Replace `YOUR_USERNAME` with the actual repository owner.

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory.

```env
NODE_ENV=development
PORT=5000

FRONTEND_URL=http://localhost:5175

MONGODB_URI=mongodb://127.0.0.1:27017/webro_management_dev

JWT_SECRET=YOUR_GENERATED_JWT_SECRET
CSRF_SECRET=YOUR_GENERATED_CSRF_SECRET

JWT_EXPIRES_IN=8h
```

Generate separate cryptographically secure secrets:

```bash
node -e "const {randomBytes}=require('node:crypto'); console.log('JWT_SECRET='+randomBytes(32).toString('hex')); console.log('CSRF_SECRET='+randomBytes(32).toString('hex'))"
```

Never commit actual secrets to version control.

### 4. Start Development Server

```bash
npm run dev
```

Expected server address:

```text
http://localhost:5000
```

### 5. Verify API Health

```http
GET http://localhost:5000/api/health
```

Example response:

```json
{
  "success": true,
  "message": "WEBRO Management API is running",
  "environment": "development",
  "timestamp": "2026-11-22T10:36:27.035Z"
}
```

The health endpoint confirms that Express is responding. It does not establish database readiness.

---

## REST API Reference

Base URL:

```text
http://localhost:5000/api
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | User login |
| GET | /auth/me | Current user |
| GET | /auth/csrf | Generate CSRF token |
| POST | /auth/logout | User logout |

### Business Modules

| Base Endpoint | Module |
|---------------|--------|
| /clients | Client management |
| /leads | Lead management |
| /calls | Call management |
| /follow-ups | Follow-up management |
| /projects | Project management |
| /payments | Payment management |
| /invoices | Invoice management |
| /tasks | Task management |
| /employees | Employee management |
| /dashboard | Business analytics |

Individual routes, request schemas, and authorization rules are defined in the corresponding route and validator files.

---

## Authentication Workflow

```text
1. User submits login credentials
              |
              v
2. Backend validates credentials
              |
              v
3. JWT session is generated
              |
              v
4. HttpOnly authentication cookie is set
              |
              v
5. Frontend requests CSRF token
              |
              v
6. Protected API requests include CSRF header
              |
              v
7. Backend validates session and permissions
              |
              v
8. Controller processes the request
```

### Authentication Cookie

```text
Cookie Name: webro_access_token
HttpOnly: true
SameSite: Strict
Secure: true in production
```

CSRF protection requires the frontend to send the session-bound token using the `X-CSRF-Token` request header for protected mutation requests.

---

## Security

The backend includes code for several application security controls.

### Implemented Security Controls

- JWT signature verification
- HttpOnly authentication cookies
- Role-based authorization
- CSRF middleware
- HTTP security headers using Helmet
- CORS origin configuration
- Request body size limits
- API rate limiting
- Login rate limiting
- Input validation
- Centralized error responses
- Password hashing verification

### Production Security Checklist

- [ ] Verify authentication and authorization flows
- [ ] Verify CSRF protection across mutation endpoints
- [ ] Test rate limiting and origin restrictions
- [ ] Validate environment variables at startup
- [ ] Confirm secure cookie behavior in deployment
- [ ] Test access restrictions between user roles
- [ ] Audit payment and invoice calculations
- [ ] Validate database transactions
- [ ] Configure HTTPS
- [ ] Configure production logging and monitoring
- [ ] Review dependency vulnerabilities
- [ ] Complete integration and security tests

---

## Database

The project uses MongoDB with Mongoose.

### Data Models

| Category | Models |
|----------|--------|
| Identity | User |
| CRM | Client, Lead, Call, FollowUp |
| Delivery | Project, Task |
| Finance | Payment, PaymentRefund, Invoice, InvoiceCounter, InvoicePaymentAllocation |
| HR | Employee, EmployeeCounter |

### Database Status

The MongoDB connection manager is implemented in `backend/src/config/db.js`.

Database startup integration and live CRUD testing are pending.

Some workflows use MongoDB transactions and require a compatible replica set or managed MongoDB deployment.

---

## Development Status

| Component | Status |
|-----------|--------|
| Backend folder structure | Implemented |
| Express application | Running locally |
| Health endpoint | Verified |
| Authentication code | Implemented, testing pending |
| Client and lead modules | Implemented, testing pending |
| Project and task modules | Implemented, testing pending |
| Employee module | Implemented, testing pending |
| Payment and invoice modules | Implemented, testing pending |
| Dashboard analytics | Implemented, testing pending |
| Security middleware | Implemented, testing pending |
| Environment configuration | Implemented |
| MongoDB connection manager | Implemented |
| MongoDB startup integration | Pending |
| API integration tests | Pending |
| Frontend dashboard | Pending |
| Production deployment | Pending |

---

## Development Roadmap

### Phase 1 — Backend Foundation

- [x] Create backend architecture
- [x] Define business data models
- [x] Implement REST API modules
- [x] Add authentication and authorization
- [x] Add request validation
- [x] Add security middleware
- [x] Create environment configuration
- [x] Create MongoDB connection manager
- [x] Verify Express health endpoint

### Phase 2 — Database Integration

- [ ] Configure MongoDB
- [ ] Integrate database connection into server startup
- [ ] Configure transaction support
- [ ] Create initial admin account
- [ ] Test database operations
- [ ] Validate indexes and constraints

### Phase 3 — API Testing

- [ ] Test authentication
- [ ] Test role-based permissions
- [ ] Test client and lead workflows
- [ ] Test project and task workflows
- [ ] Test employee operations
- [ ] Test payments and invoices
- [ ] Verify financial calculations
- [ ] Test CSRF protection
- [ ] Add automated integration tests

### Phase 4 — Frontend Dashboard

- [ ] Authentication interface
- [ ] Dashboard layout and navigation
- [ ] Client and lead management screens
- [ ] Project and task management screens
- [ ] Employee management screens
- [ ] Payments and invoices interface
- [ ] Analytics and reporting
- [ ] Responsive design
- [ ] Backend API integration

### Phase 5 — Production Deployment

- [ ] Production environment configuration
- [ ] Database deployment
- [ ] Backend hosting
- [ ] Frontend hosting
- [ ] CI/CD pipeline
- [ ] Security review
- [ ] Monitoring and error tracking
- [ ] Production verification

---

## Git Workflow

### Check Changes

```bash
git status
```

### Stage Changes

```bash
git add .
```

### Commit Changes

```bash
git commit -m "feat: initialize WEBRO management system"
```

### Push to GitHub

```bash
git push -u origin main
```

Ensure the correct remote repository is configured before pushing.

---

## Project Information

**Project:** WEBRO Management System

**Category:** Business Management / CRM / Operations

**Architecture:** Modular REST API

**Backend:** Node.js, Express.js, MongoDB

**Current Stage:** Backend development and integration

**Repository Visibility:** Private recommended

---

## License

Proprietary project.

All rights reserved. No permission to use, modify, or distribute this software is granted without authorization.

---

**WEBRO Management System — Centralizing Business Operations.**
