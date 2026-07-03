# 🛡️ SecureCBT

> **Modern, Highly-Secure, and Comprehensive Computer Based Test (CBT) Platform**

SecureCBT is a powerful, secure, and modern Next.js application designed to facilitate Computer Based Tests (CBT) for schools and institutions. Built with the Next.js App Router and Prisma (PostgreSQL), SecureCBT ensures high performance, seamless user experience, and rigorous cybersecurity standards to maintain academic integrity.

🌍 **Live Demo:** [https://secure-cbt-alpha.vercel.app/](https://secure-cbt-alpha.vercel.app/)

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Distinct dashboards and access levels for `SUPER_ADMIN`, `GURU` (Teacher), and `MURID` (Student).
- **Strict Anti-Cheat Engine:** 
  - Full-screen enforcement during exams.
  - Tab switching & window minimizing detection.
  - Blocks right-click, copy, paste, and common developer shortcuts.
  - Real-time violation logging & automatic submission upon critical infractions.
- **Advanced Exam Management:** 
  - Create Multiple Choice (PG) and Essay questions.
  - **Bulk Import via Excel (.xlsx)** for rapid question bank creation.
  - **Export Scores to Excel** directly from the dashboard.
- **Stateful JWT Authentication:** Protects against session replay and cookie injection attacks by validating session versions against the database in real-time.
- **Premium UI/UX:** Built with Tailwind CSS, utilizing glassmorphism, glowing aesthetics, and highly responsive layouts for both mobile and desktop.
- **Robust Database Architecture:** Powered by Prisma ORM connected to a PostgreSQL database (Neon), ready for massive scale.

## 🔒 Comprehensive Cybersecurity Approach

We take security seriously. SecureCBT integrates multiple layers of protection:

1. **Strict Role-Based Routing:** Next.js Edge Middleware automatically intercepts and validates access rights, ensuring users can only reach authorized endpoints. Includes a dedicated 403 Security Gateway.
2. **Encrypted Passwords:** User credentials are cryptographically hashed using `bcryptjs`.
3. **Stateful Session Validation:** Authentication state is managed via secure, HTTP-only cookies combined with a unique `sessionVersion` tracker in the database. When a user logs out, old stolen tokens are instantly invalidated.
4. **HTTP Security Headers:** Configuration enforces strict security headers to prevent framing and XSS attacks.
5. **No Hardcoded Credentials:** Production-ready authentication flow utilizing `.env` secrets.

## 📐 System Architecture & Flowchart

The following flowchart illustrates the high-level architecture and access flow within SecureCBT:

```mermaid
graph TD
    User([User]) --> Login[Login Page]
    
    Login --> AuthCheck{Authentication & Role Check}
    
    AuthCheck -- Invalid --> Login
    AuthCheck -- Valid --> Middleware[Next.js Middleware]
    
    Middleware -- SUPER_ADMIN --> AdminDash[Admin Dashboard]
    Middleware -- GURU --> TeacherDash[Teacher Dashboard]
    Middleware -- MURID --> StudentDash[Student Dashboard]
    
    AdminDash --> ManageUsers[Manage Users & Roles]
    AdminDash --> ManageExamsAdmin[Manage Exams & View All Scores]
    
    TeacherDash --> ManageExams[Create/Manage Exams]
    TeacherDash --> ImportExcel[Import Questions via Excel]
    TeacherDash --> ExportExcel[Export Student Scores]
    
    StudentDash --> EnterToken[Enter Exam Token]
    EnterToken --> TakeExam[Take Exam Environment]
    
    TakeExam --> Submits[Submit Answers]
    Submits --> AntiCheat{Anti-Cheat Verification}
    
    AntiCheat -- Clean --> SaveScore[(PostgreSQL: Prisma ORM)]
    AntiCheat -- Flagged --> SaveScoreFlagged[(PostgreSQL: Logged as Cheating)]
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm, pnpm, or yarn
- PostgreSQL Database (e.g., Neon, Supabase, or local)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Alvinhidayatullah/WEB-CBT.git
   cd clean-exam
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   Create a `.env` file in the root directory and add your database URL and JWT Secret:
   ```env
   DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
   JWT_SECRET="your_super_secret_key"
   ADMIN_SEED_PASSWORD="secure_admin_password"
   GURU_SEED_PASSWORD="secure_guru_password"
   ```
   Then run migrations and seed the database:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Alvinhidayatullah/WEB-CBT/issues).

## 📝 License
This project is [MIT](https://choosealicense.com/licenses/mit/) licensed.
