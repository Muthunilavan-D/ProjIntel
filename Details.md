# Academic Project Tracking and Management System
## OpenCode AI — Simple Build Specification

> **Goal:** Build a simple working project-management system first. Improve it later. Add AI only after the core system is complete.

---

# 1. Project

**Academic Project Tracking and Management System**

A web application for managing final-year academic projects between students, faculty guides, and administrators.

Basic workflow:

```text
Student creates project
        ↓
Submits proposal
        ↓
Faculty reviews
        ↓
Project approved
        ↓
Milestones + Tasks
        ↓
Student updates progress
        ↓
Faculty gives feedback
        ↓
Project completed
```

---

# 2. Minimal Tech Stack

Use only these technologies.

### Frontend

- **React**
- **JavaScript**
- **Bootstrap**
- **CSS**

### Backend

- **Node.js**
- **Express.js**

### Database

- **MongoDB**
- **Mongoose**

### Authentication

- **JWT**
- **bcrypt**

### File Upload

- **Multer**

### API

- **REST API**

### AI — Later

- **Python**
- **FastAPI**

Do NOT implement the AI service initially.

Do NOT introduce additional frameworks or libraries unless genuinely necessary.

---

# 3. User Roles

## Student

Student can:

- Register/login
- Create project
- Edit project
- Submit project proposal
- View project status
- View faculty guide
- View milestones
- Manage tasks
- Submit weekly progress
- Upload documents
- View faculty feedback
- View notifications

## Faculty

Faculty can:

- Login
- View assigned projects
- View students
- Review project proposals
- Approve project
- Reject project
- Request revision
- View milestones
- Monitor progress
- Review weekly updates
- Give feedback
- View documents

## Admin

Admin can:

- Login
- Manage students
- Manage faculty
- Manage departments
- Assign faculty to projects
- View all projects
- View basic statistics

---

# 4. Core Features

## 4.1 Authentication

Implement:

- Register
- Login
- Logout
- JWT authentication
- Password hashing
- Protected routes
- Role-based access

Roles:

```text
STUDENT
FACULTY
ADMIN
```

---

## 4.2 Project Management

Students create projects containing:

- Title
- Description
- Problem statement
- Objectives
- Domain
- Technologies
- Team members

Project status:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REVISION_REQUIRED
IN_PROGRESS
COMPLETED
REJECTED
```

---

## 4.3 Faculty Review

Faculty can:

- View submitted proposals
- Review project
- Approve
- Reject
- Request revision
- Add feedback

---

## 4.4 Faculty Assignment

Admin can assign a faculty guide to a project.

Display:

```text
Project
Student/Team
Faculty Guide
Department
Status
```

---

## 4.5 Milestones

Create project milestones.

Default examples:

```text
1. Problem Definition
2. Literature Survey
3. Requirements Analysis
4. System Design
5. Implementation
6. Testing
7. Documentation
8. Final Presentation
```

Each milestone contains:

- Title
- Description
- Start date
- Due date
- Status
- Completion percentage

---

## 4.6 Tasks

Students can create and manage tasks under milestones.

Each task contains:

- Title
- Description
- Priority
- Due date
- Status

Priority:

```text
LOW
MEDIUM
HIGH
```

Status:

```text
TODO
IN_PROGRESS
COMPLETED
OVERDUE
```

---

## 4.7 Weekly Progress

Students submit weekly updates:

- Week number
- Work completed
- Problems faced
- Next week's plan
- Progress percentage

Faculty can view updates and provide feedback.

Keep a history of all weekly updates.

---

## 4.8 Documents

Students can upload project documents.

Support:

```text
PDF
DOC
DOCX
PPT
PPTX
ZIP
```

Store:

- File name
- Document type
- Version
- Uploaded by
- Upload date
- File path/URL

---

## 4.9 Notifications

Provide basic notifications for:

- Proposal approval/rejection
- Revision requests
- Faculty feedback
- Upcoming deadlines
- Project status changes

---

# 5. Dashboards

## Student Dashboard

Display:

- Project status
- Overall progress
- Current milestone
- Pending tasks
- Upcoming deadlines
- Faculty feedback
- Notifications

## Faculty Dashboard

Display:

- Assigned projects
- Active projects
- Completed projects
- Delayed projects
- Pending reviews

Project table:

```text
Project | Student | Progress | Status | Deadline
```

## Admin Dashboard

Display:

- Total students
- Total faculty
- Total projects
- Active projects
- Completed projects
- Departments

---

# 6. Main Pages

### Common

```text
/login
/register
```

### Student

```text
/student/dashboard
/student/project
/student/project/create
/student/project/:id
/student/project/:id/milestones
/student/project/:id/tasks
/student/project/:id/progress
/student/project/:id/documents
/student/project/:id/feedback
```

### Faculty

```text
/faculty/dashboard
/faculty/projects
/faculty/projects/:id
/faculty/projects/:id/progress
/faculty/projects/:id/documents
/faculty/projects/:id/feedback
```

### Admin

```text
/admin/dashboard
/admin/users
/admin/students
/admin/faculty
/admin/departments
/admin/projects
```

---

# 7. MongoDB Collections

Use MongoDB with Mongoose.

Create these collections/models:

```text
User
Department
Project
Milestone
Task
WeeklyProgress
Feedback
Document
Notification
```

Basic relationships:

```text
User
 ├── Student
 └── Faculty

Project
 ├── Students
 ├── Faculty
 ├── Milestones
 ├── Tasks
 ├── WeeklyProgress
 ├── Feedback
 └── Documents
```

Use MongoDB ObjectId references where appropriate.

---

# 8. REST API

Keep APIs simple.

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/submit
POST   /api/projects/:id/approve
POST   /api/projects/:id/reject
POST   /api/projects/:id/revision
```

### Milestones

```text
GET    /api/projects/:projectId/milestones
POST   /api/projects/:projectId/milestones
PUT    /api/milestones/:id
DELETE /api/milestones/:id
```

### Tasks

```text
GET    /api/milestones/:milestoneId/tasks
POST   /api/milestones/:milestoneId/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

### Progress

```text
GET  /api/projects/:projectId/progress
POST /api/projects/:projectId/progress
PUT  /api/progress/:id
```

### Feedback

```text
GET  /api/projects/:projectId/feedback
POST /api/projects/:projectId/feedback
```

### Documents

```text
GET    /api/projects/:projectId/documents
POST   /api/projects/:projectId/documents
DELETE /api/documents/:id
```

---

# 9. UI Requirements

Keep the UI simple and professional.

Use:

- Bootstrap navbar
- Bootstrap sidebar
- Cards
- Tables
- Forms
- Tabs
- Progress bars
- Status badges
- Modals
- Alerts

The application should be:

- Responsive
- Clean
- Easy to understand
- Easy to navigate

Include basic:

- Loading messages
- Empty states
- Error messages
- Confirmation dialogs

Do not spend excessive time on animations or visual effects.

---

# 10. Security

Implement:

- bcrypt password hashing
- JWT authentication
- Protected routes
- Role-based authorization
- Backend validation
- File type/size validation
- `.env` for secrets
- CORS

Never store plain-text passwords.

Never trust frontend authorization alone.

---

# 11. Simple Folder Structure

```text
academic-project-system/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
│
├── server/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── .env
├── .gitignore
└── README.md
```

Keep the architecture simple.

---

# 12. Development Order

Follow this order.

## Phase 1 — Setup

Create:

- React frontend
- Node.js + Express backend
- MongoDB connection
- Mongoose models
- Basic Bootstrap UI
- Basic `/api/health` endpoint

## Phase 2 — Authentication

Build:

- Register
- Login
- JWT
- bcrypt
- Role-based access

## Phase 3 — Projects

Build:

- Create project
- Edit project
- Submit proposal
- Faculty review
- Approval/rejection
- Revision request
- Faculty assignment

## Phase 4 — Tracking

Build:

- Milestones
- Tasks
- Weekly progress
- Faculty feedback

## Phase 5 — Documents + Notifications

Build:

- File uploads
- Document listing
- Notifications

## Phase 6 — Dashboards

Build:

- Student dashboard
- Faculty dashboard
- Admin dashboard

## Phase 7 — Testing + Improvements

Improve:

- Validation
- Authorization
- Error handling
- Responsive UI
- Bug fixing
- Database handling
- Deployment

## Phase 8 — AI

Only after the above is working.

---

# 13. AI Features — FUTURE

Do not implement now.

Later add an independent Python/FastAPI AI service.

### AI Feasibility Analysis

Analyze:

- Problem statement
- Objectives
- Technologies
- Scope
- Timeline

Return:

- Feasibility
- Complexity
- Risks
- Suggestions

### AI Roadmap Generation

Generate:

- Milestones
- Tasks
- Timeline

### AI Progress Analysis

Analyze project progress and identify problems.

### AI Risk Prediction

Predict:

```text
LOW
MEDIUM
HIGH
```

### AI Delay Prediction

Predict whether the project is likely to miss its deadline.

### AI Recommendations

Suggest actions based on project progress.

### AI Viva Assistant

Generate project-specific viva questions and answers.

---

# 14. OpenCode Rules

When building this project:

1. Read this specification first.
2. Build one phase at a time.
3. Do not implement AI initially.
4. Inspect existing files before modifying them.
5. Do not rewrite working code unnecessarily.
6. Keep the architecture simple.
7. Do not add unfamiliar technologies.
8. Use MongoDB + Mongoose.
9. Test each feature before moving forward.
10. Fix errors before starting the next phase.
11. Do not create fake/unfinished functionality and mark it complete.
12. Clearly report what was implemented and what remains.

---

# 15. MASTER PROMPT FOR OPENCODE

Copy this prompt into OpenCode:

```text
You are developing my Final Year Project:

"Academic Project Tracking and Management System"

Read the project specification provided with this project and use it as the main requirement.

I have limited time, so build a SIMPLE and WORKING MVP first.

Use only this technology stack:

Frontend:
- React
- JavaScript
- Bootstrap
- CSS

Backend:
- Node.js
- Express.js

Database:
- MongoDB
- Mongoose

Authentication:
- JWT
- bcrypt

File uploads:
- Multer

API:
- REST API

Future AI:
- Python + FastAPI

IMPORTANT:
Do NOT implement AI features now.

The initial application must support:

1. Student, Faculty and Admin login
2. Role-based access
3. Student project creation
4. Project proposal submission
5. Faculty review
6. Faculty approval/rejection/revision
7. Faculty assignment
8. Project milestones
9. Project tasks
10. Weekly progress updates
11. Faculty feedback
12. Project document uploads
13. Notifications
14. Student dashboard
15. Faculty dashboard
16. Admin dashboard

Development order:

PHASE 1:
Setup React, Express and MongoDB.

PHASE 2:
Authentication and role-based access.

PHASE 3:
Project management and faculty assignment.

PHASE 4:
Milestones, tasks, weekly progress and feedback.

PHASE 5:
Documents and notifications.

PHASE 6:
Dashboards.

PHASE 7:
Testing, bug fixing, validation, security and UI improvements.

PHASE 8:
AI features, only when I explicitly ask for them.

RULES:

- Keep the project simple.
- Do not introduce unnecessary technologies.
- Do not use TypeScript.
- Do not use PostgreSQL.
- Do not use Prisma.
- Do not use complex architecture.
- Use MongoDB with Mongoose.
- Inspect existing code before changing it.
- Do not overwrite working code unnecessarily.
- Build one phase at a time.
- Test every phase.
- Fix errors before moving to the next phase.
- Do not implement future features early.
- Keep frontend and backend code organized.
- Use environment variables for secrets.
- Enforce authorization on the backend.

For every phase:

1. Inspect the current project.
2. Implement only that phase.
3. Run the application.
4. Test the implemented functionality.
5. Fix errors.
6. Make sure existing functionality still works.
7. Tell me what files/features were added or changed.
8. Tell me what remains.
9. Stop and wait for my next instruction.

START WITH PHASE 1 ONLY.
Do not implement authentication, project management, dashboards or AI yet.
```

---

# 16. First Instruction to OpenCode

After giving OpenCode the specification, use:

```text
Read the complete project specification.

Start with PHASE 1 only.

Create the React frontend using JavaScript and Bootstrap.

Create the Node.js + Express backend.

Connect the backend to MongoDB using Mongoose.

Create the basic folder structure.

Create the MongoDB connection.

Create a simple GET /api/health endpoint.

Create a basic React home page.

Create .env.example and .gitignore.

Install required dependencies.

Run the frontend and backend.

Verify that the MongoDB connection works.

Verify that /api/health works.

Fix any errors.

Do NOT implement authentication, projects, milestones, dashboards or AI yet.

Stop after Phase 1 is working and report the result.
```

---

# 17. Final Architecture

```text
                 React
                   │
                   │ REST API
                   ▼
             Node.js
                   │
                Express
                   │
                   ▼
               MongoDB
                   │
                Mongoose


          Later — AI Layer

               Node.js
                  │
                  ▼
          Python / FastAPI
                  │
          ┌───────┼────────┐
          ▼       ▼        ▼
       Feasibility Roadmap Risk
          │       │        │
          └───────┴────────┘
              Recommendations
```

## Key Principle

**Do not try to build the final AI-powered system immediately.**

First get this working:

```text
Login
  ↓
Create Project
  ↓
Faculty Review
  ↓
Approve
  ↓
Milestones
  ↓
Tasks
  ↓
Weekly Progress
  ↓
Faculty Feedback
  ↓
Completion
```

Once this works reliably, improve the UI/system and then add the AI layer.
