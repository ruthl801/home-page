# MasterReg — Backend Plan

## Tech Stack Recommendation

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js + Express | Fast to build, great ecosystem |
| Database | PostgreSQL | Relational — perfect for students, applications, specialties |
| Auth | JWT + University SSO (CAS) | Students already have IDs |
| AI (Orienta) | Anthropic Claude API | Context-aware specialty answers |
| Email | Nodemailer + SMTP | Deadline reminders, result notifications |
| Hosting | Railway / Render / VPS | Simple deployment |

---

## Database Schema

```sql
-- Students (synced from university system)
CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    VARCHAR(20) UNIQUE NOT NULL,   -- e.g. 202301 45423
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  major         VARCHAR(100),
  year          INT,
  gpa           DECIMAL(3,2),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Specializations (admin-managed)
CREATE TABLE specializations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) UNIQUE,
  description   TEXT,
  seats         INT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE
);

-- Applications (one per student per cycle)
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID REFERENCES students(id),
  cycle_year    INT NOT NULL,               -- e.g. 2026
  status        VARCHAR(20) DEFAULT 'draft', -- draft | submitted | placed | rejected
  submitted_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, cycle_year)
);

-- Ranked choices (the core data)
CREATE TABLE application_choices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID REFERENCES applications(id) ON DELETE CASCADE,
  specialization_id UUID REFERENCES specializations(id),
  rank            INT NOT NULL,             -- 1 = first choice
  UNIQUE(application_id, rank),
  UNIQUE(application_id, specialization_id)
);

-- Placement results (after deadline)
CREATE TABLE placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id),
  specialization_id UUID REFERENCES specializations(id),
  cycle_year      INT NOT NULL,
  placed_at       TIMESTAMP DEFAULT NOW()
);

-- Enrollment cycles (admin-controlled dates)
CREATE TABLE enrollment_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            INT UNIQUE NOT NULL,
  enrollment_open DATE,
  submission_deadline DATE,
  results_date    DATE,
  is_active       BOOLEAN DEFAULT FALSE
);
```

---

## API Endpoints

### Auth
```
POST   /api/auth/login          -- { student_id, password } → JWT token
POST   /api/auth/logout
GET    /api/auth/me             -- current student profile
```

### Specializations
```
GET    /api/specializations                 -- list all active specialties
GET    /api/specializations/:slug           -- single specialty detail
```

### Applications
```
GET    /api/application                     -- get student's current application
POST   /api/application                     -- create application (draft)
PUT    /api/application/choices             -- update ranked choices (saves as draft)
POST   /api/application/submit              -- finalize & lock application
DELETE /api/application/choices/:id         -- remove a choice
```

### Orienta AI
```
POST   /api/orienta/chat        -- { message, history[] } → AI reply
```

### Admin (protected)
```
GET    /api/admin/applications         -- all submitted applications
POST   /api/admin/run-placement        -- trigger placement algorithm
GET    /api/admin/results              -- view placement results
POST   /api/admin/notify-results       -- send result emails
GET    /api/admin/specializations      -- manage specialties
POST   /api/admin/specializations
PUT    /api/admin/specializations/:id
```

---

## Placement Algorithm

```
AFTER deadline:
  For each specialization (sorted by GPA desc):
    1. Collect all students who ranked this specialty
    2. Sort by: rank_position ASC, then GPA DESC
    3. Assign top N students (N = seats)
    4. Mark remaining students as needing next-choice check

  Fallback:
    Students not placed in any choice → waitlisted or assigned last available
```

**Implementation** (`/api/admin/run-placement`):
```javascript
async function runPlacement(cycleYear) {
  const apps = await db.query(`
    SELECT ac.*, s.gpa, s.student_id, ac.specialization_id, ac.rank
    FROM application_choices ac
    JOIN applications a ON a.id = ac.application_id
    JOIN students s ON s.id = a.student_id
    WHERE a.cycle_year = $1 AND a.status = 'submitted'
    ORDER BY ac.rank ASC, s.gpa DESC
  `, [cycleYear]);

  const seatMap = {}; // specialization_id → remaining seats
  const placed = new Set(); // student_ids already placed

  for (const choice of apps) {
    if (placed.has(choice.student_id)) continue;
    if (!seatMap[choice.specialization_id]) {
      const spec = await getSpecSeats(choice.specialization_id);
      seatMap[choice.specialization_id] = spec.seats;
    }
    if (seatMap[choice.specialization_id] > 0) {
      await insertPlacement(choice.student_id, choice.specialization_id, cycleYear);
      seatMap[choice.specialization_id]--;
      placed.add(choice.student_id);
    }
  }
}
```

---

## Orienta AI Integration

```javascript
// POST /api/orienta/chat
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `
You are Orienta, an AI assistant for the University of Kasdi Merbah Ouargla master's enrollment portal.
You ONLY answer questions about specializations available at this university:
- Cybersecurity (20 seats): 40% theory, 60% practical — networks, ethical hacking, cryptography
- Artificial Intelligence (30 seats): ML, deep learning, NLP, computer vision
- Software Engineering (25 seats): system design, Agile, cloud, DevOps
- Data Science (20 seats): statistics, big data, visualization, ML pipelines
- Computer Networks (15 seats): protocols, infrastructure, IoT

Answer in the same language the student uses (Arabic or French or English).
Be concise, helpful, and factual. Do not make up information.
`;

export async function chat(req, res) {
  const { message, history = [] } = req.body;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      ...history,
      { role: 'user', content: message }
    ]
  });

  res.json({ reply: response.content[0].text });
}
```

---

## Project File Structure

```
masterreg-backend/
├── src/
│   ├── index.js              # Express app entry
│   ├── config/
│   │   ├── db.js             # PostgreSQL pool
│   │   └── env.js            # env validation
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   └── adminOnly.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── specializations.js
│   │   ├── application.js
│   │   ├── orienta.js
│   │   └── admin.js
│   ├── services/
│   │   ├── placement.js      # Algorithm
│   │   ├── mailer.js         # Email notifications
│   │   └── orienta.js        # Claude API wrapper
│   └── db/
│       ├── migrations/       # SQL migration files
│       └── seeds/            # Sample data
├── .env
├── package.json
└── README.md
```

---

## Implementation Order (Step by Step)

### Phase 1 — Foundation (Week 1)
1. Set up Express + PostgreSQL
2. Write database migrations
3. Seed specializations data
4. Implement JWT auth (`/api/auth/login`)

### Phase 2 — Core Application (Week 2)
5. Build `/api/specializations` endpoints
6. Build `/api/application` CRUD endpoints
7. Test drag-and-drop saving from frontend

### Phase 3 — AI & Notifications (Week 3)
8. Wire up Orienta AI via Claude API
9. Set up Nodemailer for email
10. Build deadline reminder cron job

### Phase 4 — Admin & Placement (Week 4)
11. Build admin dashboard endpoints
12. Implement & test placement algorithm
13. Build results notification system

### Phase 5 — Polish & Deploy (Week 5)
14. Add input validation (zod/joi)
15. Add rate limiting
16. Write tests (Jest)
17. Deploy to Railway/Render
18. Connect frontend to live API

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/masterreg

# Auth
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Anthropic (Orienta AI)
ANTHROPIC_API_KEY=sk-ant-...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@masterreg.dz
SMTP_PASS=your-app-password

# Admin
ADMIN_SECRET=admin-setup-token
```

---

## Quick Start (after clone)

```bash
npm install
cp .env.example .env         # fill in your values
npm run db:migrate           # create tables
npm run db:seed              # add sample data
npm run dev                  # start dev server on :3000
```
