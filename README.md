# School Schedule Management System

A modern schedule management system for elementary schools (grades 1-6) with full Hebrew support and RTL interface.

## Key Features

### 🏫 Schedule Management
- **Full Week View**: Sunday through Thursday (learning days)
- **Interactive Class Selection**: Click on cells to open selection drawer
- **Conflict Detection**: System identifies and warns about time overlaps
- **Grade Filtering**: Option to display only relevant classes

### 👥 User and Role Management
- **Multiple Roles**: Admin, Parent, Student, Staff
- **Role Switching**: Users can switch between different roles
- **Approval System**: New registrations require admin approval
- **Multi-Channel Authentication**: Email/password + OAuth (Google, GitHub)

### 🔒 Security and Access Control
- **Row Level Security**: Database-level protection
- **Role-Based Permissions**: Each role sees and can perform appropriate actions
- **Secure Authentication**: Through Supabase Auth

## Tech Stack

### Frontend
- **React 18** + **TypeScript** - Modern and type-safe framework
- **Vite** - Fast build tool and dev server
- **Ant Design** - UI library with full RTL support
- **Hebrew RTL** - Interface optimized for Hebrew-speaking users

### Backend
- **Supabase** - Complete Backend-as-a-Service
  - PostgreSQL database
  - Built-in user authentication
  - Real-time subscriptions
  - Row Level Security (RLS)

### Development & Testing
- **Storybook** - Component development in isolation
- **Vitest** - Fast unit testing
- **ESLint** + **TypeScript** - Code quality assurance

## Installation and Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Project Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd school-schedule
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Create a new project at [Supabase](https://supabase.com)
   - Copy the URL and anon key from the dashboard
   - Create `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Setup database**
   - Open SQL Editor in Supabase
   - Run each migration file from `src/migrations/` in order:
     1. `001_initial_schema.sql`
     2. `002_rls_policies.sql`
     3. `003_triggers_functions.sql`
     4. `004_sample_data.sql`
   - Or use `npm run migrate` for guidance
   - Verify all tables and policies were created successfully

### Running the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run Storybook
npm run storybook

# Run tests
npm run test

# Database migrations
npm run migrate        # Show migration guidance
npm run migrate:status # Check migration status
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ScheduleTable.tsx        # Main schedule table
│   ├── ClassSelectionDrawer.tsx # Class selection drawer
│   └── *.css                    # Component styles
├── pages/              # Main application pages
│   ├── LoginPage.tsx            # Login page
│   ├── SignupPage.tsx           # Signup page
│   ├── SchedulePage.tsx         # Main schedule page
│   └── *.css                    # Page styles
├── hooks/              # Custom React hooks
│   ├── useAuth.ts              # Authentication management
│   └── useSchedule.ts          # Schedule data management
├── services/           # API and business logic layer
│   ├── api.ts                  # Supabase API calls
│   ├── supabase.ts            # Supabase client setup
│   └── scheduleService.ts     # Schedule business logic
├── contexts/           # React contexts
│   └── AuthContext.tsx        # Global authentication context
├── types/              # TypeScript definitions
│   └── index.ts               # Core data types
├── utils/              # Utility functions
├── stories/            # Storybook stories
└── main.tsx            # Application entry point
```

## Database Schema

### Main Tables

- **`users`** - User profiles (extends auth.users)
- **`user_roles`** - User roles and approval status
- **`time_slots`** - Class time slots (customizable by days and times)
- **`classes`** - Classes (title, teacher, grade, description)
- **`schedule_selections`** - User class selections

### Database Security
- Row Level Security (RLS) enabled on all tables
- Role-based access policies for each table
- Protection against unauthorized data access

## Usage Guide

### For New Users
1. **Registration**: Fill out registration form and select relevant roles
2. **Await Approval**: Wait for admin approval
3. **Login**: After approval, login with provided credentials

### For Students and Parents
1. **View Schedule**: See the weekly schedule table
2. **Select Classes**: Click on table cells to select classes
3. **Manage Conflicts**: System will alert about overlaps and suggest solutions

### For Staff and Admins
1. **Manage Classes**: Add, edit, and delete classes
2. **Manage Time Slots**: Adjust class times as needed
3. **Approve Users**: Approve new registration requests

## Development

### Adding New Features
1. Create new branch from main
2. Develop component in Storybook first
3. Write tests for new functionality
4. Ensure code passes lint and typecheck

### Running Tests
```bash
# Unit tests
npm run test

# TypeScript check
npm run typecheck

# Code quality check
npm run lint
```

### Storybook
Open Storybook for isolated component development:
```bash
npm run storybook
```

## Deployment

### Vercel (Recommended)
1. Connect repository to Vercel
2. Configure environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Deploy automatically with each push

### Manual Deployment
```bash
npm run build
# Upload dist folder to web server
```

## Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License. See `LICENSE` file for details.

## Support

For questions, issues, or suggestions:
- Open an Issue on GitHub
- Contact the development team
- Check the documentation in Storybook

---

💡 **Tip**: Use Storybook to view and test all components before using the full application.