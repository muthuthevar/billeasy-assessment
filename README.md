# Secure File Upload & Metadata Processing Microservice

A robust Node.js backend microservice built with NestJS that handles authenticated file uploads, stores metadata in PostgreSQL, and processes files asynchronously using BullMQ with Redis.

## Features

- **JWT Authentication**: Secure user registration and login
- **File Upload**: Multi-part file upload with metadata
- **Async Processing**: Background file processing with job queues
- **Database Integration**: PostgreSQL with TypeORM
- **Rate Limiting**: Prevent abuse with configurable limits
- **API Documentation**: Swagger/OpenAPI integration
- **Docker Support**: Easy deployment with Docker Compose
- **Security**: Input validation, user isolation, file size limits

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Queue**: BullMQ with Redis
- **Authentication**: JWT
- **File Upload**: Multer
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator
- **Security**: bcrypt, rate limiting

## Prerequisites

- Node.js (>=18)
- PostgreSQL
- Redis
- npm or yarn or pnpm

## Installation

### Local Setup

1. **Clone the repository**

```bash
git clone https://github.com/muthuthevar/billeasy-assessment.git || git clone git@github.com:muthuthevar/billeasy-assessment.git
cd billeasy-assessment
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start PostgreSQL and Redis**

```bash
# Using Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=fileupload -p 5432:5432 -d postgres:15-alpine
docker run --name redis -p 6379:6379 -d redis:7-alpine
```

5. **Run the application**

```bash
pnpm run start:dev
```

## API Documentation

Once the application is running, access the Swagger documentation at:

- **Development**: http://localhost:3000/api/docs
- **Production**: https://your-domain.com/api/docs

## Authentication Flow

### 1. Register a new user

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

## File Operations

### Upload a file

```bash
curl -X POST http://localhost:3000/files/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/file.pdf" \
  -F "title=Important Document" \
  -F "description=This is a test document"
```

Response:

```json
{
  "id": 1,
  "status": "uploaded"
}
```

### Get file status

```bash
curl -X GET http://localhost:3000/files/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:

```json
{
  "id": 1,
  "originalFilename": "document.pdf",
  "title": "Important Document",
  "description": "This is a test document",
  "status": "processed",
  "extractedData": "{\"fileSize\":1234,\"sha256Hash\":\"abc123...\",\"processedAt\":\"2023-12-01T10:00:00.000Z\"}",
  "uploadedAt": "2023-12-01T09:59:30.000Z",
  "jobs": [
    {
      "id": 1,
      "jobType": "file_processing",
      "status": "completed",
      "startedAt": "2023-12-01T09:59:31.000Z",
      "completedAt": "2023-12-01T09:59:35.000Z"
    }
  ]
}
```

### List all files (with pagination)

```bash
curl -X GET "http://localhost:3000/files?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Database Schema

#### Users

| Column     | Type   | Description                                   |
| ---------- | ------ | --------------------------------------------- |
| id         | number | Primary key (auto-increment)                  |
| email      | string | Unique user email                             |
| password   | string | Hashed password (excluded from serialization) |
| created_at | Date   | Timestamp of user creation                    |
| updated_at | Date   | Timestamp of last update                      |

Relations:

One-to-many with File (a user can upload multiple files)

#### Files

| Column            | Type   | Description                                          |
| ----------------- | ------ | ---------------------------------------------------- |
| id                | number | Primary key (auto-increment)                         |
| user_id           | number | Foreign key to User                                  |
| original_filename | string | Original name of the uploaded file                   |
| storage_path      | string | Path in storage (nullable)                           |
| title             | string | Custom title (nullable)                              |
| description       | text   | File description (nullable)                          |
| status            | enum   | File status: uploaded, processing, processed, failed |
| extracted_data    | text   | Parsed data from file (nullable)                     |
| uploaded_at       | Date   | File upload timestamp                                |
| created_at        | Date   | Record creation timestamp                            |
| updated_at        | Date   | Record update timestamp                              |

Relations:

Many-to-one with User (on user_id)

One-to-many with Job (a file can have multiple jobs)

#### Jobs

| Column        | Type   | Description                                       |
| ------------- | ------ | ------------------------------------------------- |
| id            | number | Primary key (auto-increment)                      |
| file_id       | number | Foreign key to File                               |
| job_type      | enum   | Type of job. Current option: file_processing      |
| status        | enum   | Job status: queued, processing, completed, failed |
| error_message | text   | Error description if job fails (nullable)         |
| started_at    | Date   | Timestamp when job started (nullable)             |
| completed_at  | Date   | Timestamp when job completed (nullable)           |
| created_at    | Date   | Job creation timestamp                            |
| updated_at    | Date   | Job update timestamp                              |

Relations:

Many-to-one with File (on file_id)

### Enums

#### FileStatus

- uploaded
- processing
- processed
- failed

#### JobStatus

- queued
- processing
- completed
- failed

#### JobType

- file_processing
