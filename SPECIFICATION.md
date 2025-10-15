# Project Gutenberg Reader - Technical Specification

## Project Overview

A modern web application for discovering, reading, and tracking progress on classic literature from Project Gutenberg. The application provides a seamless reading experience with user authentication, personal libraries, and AI-powered book summaries.

**Live URL:** [To be configured]

---

## Technology Stack

### Frontend
- **Framework:** React 18.3.1 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS with custom design system
- **UI Components:** shadcn/ui (Radix UI primitives)
- **State Management:** React Hooks
- **Routing:** React Router DOM v6
- **Form Handling:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **Notifications:** Sonner (toast notifications)

### Backend & Database
- **Backend Platform:** Supabase
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Serverless Functions:** Supabase Edge Functions (Deno)
- **Security:** Row Level Security (RLS) policies

### External APIs
- **Book Data:** Gutendex API (Project Gutenberg catalog)
- **Book Content:** Project Gutenberg text files
- **AI Features:** Lovable AI Gateway

---

## Architecture Overview

### Application Structure
```
Frontend (React SPA)
    ↓
Supabase Client
    ↓
┌─────────────────────────────────────┐
│         Supabase Backend            │
├─────────────────────────────────────┤
│ • Authentication (Email/Password)   │
│ • PostgreSQL Database               │
│ • Edge Functions (Deno)             │
│ • Row Level Security                │
└─────────────────────────────────────┘
    ↓
External APIs (Gutendex, Gutenberg.org)
```

---

## Database Schema

### Tables

#### `profiles`
User profile information and reading statistics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | References auth.users |
| username | text | No | - | Display name |
| email | text | Yes | - | User email |
| bio | text | Yes | - | User biography |
| books_read | integer | Yes | 0 | Total books completed |
| reading_preferences | jsonb | Yes | - | User preferences (JSON) |
| created_at | timestamptz | No | now() | Creation timestamp |
| updated_at | timestamptz | No | now() | Last update timestamp |

**RLS Policies:**
- Users can view their own profile (SELECT)
- Users can insert their own profile (INSERT)
- Users can update their own profile (UPDATE)
- Users cannot delete profiles (DELETE disabled)

#### `user_books`
User's personal library and reading progress.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | Owner of the book entry |
| gutenberg_id | integer | No | - | Project Gutenberg book ID |
| book_title | text | No | - | Book title |
| author | text | Yes | - | Book author |
| status | text | No | 'bookmarked' | Reading status |
| progress | integer | Yes | 0 | Reading progress (0-100) |
| last_read_at | timestamptz | Yes | - | Last reading timestamp |
| created_at | timestamptz | No | now() | Creation timestamp |
| updated_at | timestamptz | No | now() | Last update timestamp |

**Status Values:** `bookmarked`, `reading`, `completed`

**RLS Policies:**
- Users can view their own books (SELECT)
- Users can insert their own books (INSERT)
- Users can update their own books (UPDATE)
- Users can delete their own books (DELETE)

### Database Functions

#### `handle_new_user()`
**Trigger:** AFTER INSERT ON auth.users
**Purpose:** Automatically creates a profile entry when a new user signs up
**Logic:**
- Inserts a new row in `profiles` table
- Sets username to provided value or generates one from user ID

#### `update_updated_at_column()`
**Trigger:** BEFORE UPDATE ON profiles, user_books
**Purpose:** Automatically updates the `updated_at` timestamp on record modification

---

## Authentication System

### Authentication Flow

```
1. Sign Up
   ↓
2. Email Verification (Supabase sends email)
   ↓
3. Email Confirmation
   ↓
4. Auto Profile Creation (via handle_new_user trigger)
   ↓
5. Session Established
```

### Implementation Details

**Provider:** Supabase Auth (Email/Password)

**Features:**
- Email verification required
- Secure password handling (bcrypt)
- JWT-based sessions
- Auto-refresh tokens
- Local storage persistence

**Security:**
- Zod schema validation for inputs
- Password strength requirements
- Rate limiting (Supabase default)
- Row Level Security on all tables

**Components:**
- `AuthForm.tsx` - Handles sign up and sign in UI/logic
- `Index.tsx` - Auth state management and routing

---

## Edge Functions (Serverless API)

### Function: `search-books`
**Endpoint:** `/functions/v1/search-books`
**Authentication:** Not required (verify_jwt = false)
**Method:** GET, POST

**Purpose:** Search Project Gutenberg catalog via Gutendex API

**Parameters:**
- `searchTerm` (string, required) - Search query
- `searchType` (string, required) - Either 'title' or 'author'

**Logic:**
1. Constructs Gutendex API URL based on search type
2. Implements retry logic with exponential backoff (max 3 attempts)
3. Filters results to include only readable formats (HTML, plain text)
4. Deduplicates results by Gutenberg ID
5. Sorts by download count (popularity)
6. Returns array of book objects

**Response Format:**
```typescript
{
  results: Array<{
    id: number;
    title: string;
    authors: Array<{ name: string }>;
    subjects: string[];
    download_count: number;
    formats: {
      "text/html"?: string;
      "text/plain"?: string;
      // ... other formats
    };
  }>
}
```

### Function: `fetch-book-content`
**Endpoint:** `/functions/v1/fetch-book-content`
**Authentication:** Not required (verify_jwt = false)
**Method:** POST

**Purpose:** Fetch full book text from Project Gutenberg

**Parameters:**
- `url` (string, required) - Direct URL to book content (HTML or text)

**Logic:**
1. Validates URL parameter
2. Fetches content from Project Gutenberg
3. Returns raw text content

**Response Format:**
```typescript
{
  content: string; // Full book text
}
```

### Function: `generate-synopsis`
**Endpoint:** `/functions/v1/generate-synopsis`
**Authentication:** Not required (verify_jwt = false)
**Method:** POST

**Purpose:** Generate AI-powered book synopsis using Lovable AI Gateway

**Parameters:**
- `bookTitle` (string, required)
- `author` (string, required)
- `excerpt` (string, required) - First portion of book text

**External Dependency:** Lovable AI Gateway
**Required Secret:** `LOVABLE_API_KEY`

**Logic:**
1. Validates input parameters
2. Constructs AI prompt with book details
3. Calls Lovable AI Gateway (OpenAI-compatible API)
4. Parses and returns generated synopsis

**Response Format:**
```typescript
{
  synopsis: string; // AI-generated book summary
}
```

---

## Component Architecture

### Page Components

#### `Index.tsx` (/)
**Purpose:** Root page - handles authentication routing
**Logic:**
- Manages auth state with Supabase listeners
- Shows loading spinner during auth check
- Renders `AuthForm` if not authenticated
- Renders `Dashboard` if authenticated

#### `Dashboard.tsx` (/dashboard)
**Purpose:** Main authenticated user interface
**Features:**
- User profile display
- Reading statistics
- Book search interface
- Personal library view
- Book reader modal

**Props:**
- `user`: Supabase User object
- `onSignOut`: Sign out callback

#### `NotFound.tsx` (404)
**Purpose:** 404 error page
**Features:** Link back to home

### Feature Components

#### `AuthForm.tsx`
**Purpose:** Authentication UI (sign up/sign in)
**Features:**
- Tab interface for sign up/sign in
- Form validation with Zod
- Error handling and display
- Success callbacks

**Validation Rules:**
- Username: 3-20 characters, alphanumeric + underscores
- Email: Valid email format
- Password: Minimum 6 characters

#### `BookSearch.tsx`
**Purpose:** Search Project Gutenberg catalog
**Features:**
- Search by title or author (tabs)
- Real-time search with loading states
- Results display with book cards
- Book selection callback
- Empty states

**Props:**
- `onBookSelect`: Callback when user selects a book

#### `BookReader.tsx`
**Purpose:** Full-screen book reading interface
**Features:**
- Text content display with formatting
- Chapter navigation
- Progress tracking (scroll-based)
- Auto-save reading progress
- AI-generated synopsis
- Add to library functionality
- Full-screen mode
- Font size adjustment
- Line height adjustment
- Reading statistics

**Props:**
- `book`: Book object with metadata
- `onClose`: Close reader callback

**Reading Progress Logic:**
- Calculates progress based on scroll position
- Saves to database every 5% increment
- Updates `user_books` table automatically

**Chapter Detection:**
- Multiple regex patterns for chapter headings
- "Jump to Chapter" dropdown for navigation
- Displays full content if no chapter selected

---

## Key Features

### 1. Book Discovery
- Search by title or author
- Results from 70,000+ free books
- Filters for readable formats only
- Sorted by popularity (download count)

### 2. Reading Experience
- Clean, distraction-free interface
- Customizable font size and line height
- Chapter navigation
- Progress tracking
- Full-screen mode
- Automatic bookmark saving

### 3. Personal Library
- Save books to personal collection
- Track reading status (bookmarked, reading, completed)
- View reading progress
- Last read timestamp

### 4. AI Features
- Auto-generated book synopses
- Uses first 3000 characters as context
- Powered by Lovable AI Gateway

### 5. User Profiles
- Display name and bio
- Reading statistics
- Books read counter
- Account management

---

## Design System

### Color Tokens (HSL)
Defined in `src/index.css` with CSS custom properties:
- `--background`: Base background color
- `--foreground`: Base text color
- `--primary`: Primary brand color
- `--secondary`: Secondary color
- `--accent`: Accent highlights
- `--muted`: Muted backgrounds
- `--border`: Border colors
- `--destructive`: Error/danger states

### Typography
- Font stack: System fonts for optimal performance
- Responsive font sizes using Tailwind classes
- Line height variants for reading comfort

### Components
All UI components follow shadcn/ui patterns with:
- Consistent spacing scale
- Semantic color tokens
- Responsive design
- Dark mode support (via next-themes)
- Accessibility best practices

---

## State Management

### Authentication State
- Managed in `Index.tsx`
- Uses Supabase auth state listener
- Persisted in localStorage
- Auto-refresh on token expiration

### Book Reader State
```typescript
- fullBookContent: string | null  // Complete book text
- bookContent: string | null      // Displayed content (filtered)
- chapters: ChapterInfo[]         // Detected chapters
- currentProgress: number         // Reading progress %
- fontSize: number                // User preference
- lineHeight: number              // User preference
- isFullscreen: boolean           // Display mode
- synopsis: string | null         // AI-generated summary
```

### Library State
- Fetched from `user_books` table via Supabase
- Real-time updates with `.from().select()`
- Optimistic UI updates on mutations

---

## API Integration

### Gutendex API
**Base URL:** `https://gutendex.com/books`

**Endpoints Used:**
- Search by title: `/?search={term}`
- Search by author: `/?search={term}&topic=author`

**Response Caching:** None (client-side)
**Rate Limiting:** Uses retry logic with backoff

### Project Gutenberg
**Base URL:** `https://www.gutenberg.org`

**Content Types:**
- HTML format: Better formatting, easier to parse
- Plain text: Fallback option

**Access:** Direct file download via public URLs

---

## Security Implementation

### Row Level Security (RLS)
All tables have RLS enabled with policies:
- Users can only access their own data
- No cross-user data leakage
- Enforced at database level

### Input Validation
- Client-side: Zod schemas
- Server-side: Type checking in Edge Functions
- SQL injection prevention: Supabase client parameterization

### Authentication Security
- JWT tokens with expiration
- HTTP-only cookies (Supabase default)
- CORS configured for Edge Functions
- No sensitive data in client-side storage

---

## Environment Variables

### Required Variables
```
VITE_SUPABASE_PROJECT_ID=jnttwzuqutvsfrhpnwrz
VITE_SUPABASE_URL=https://jnttwzuqutvsfrhpnwrz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
```

### Supabase Secrets
```
SUPABASE_SERVICE_ROLE_KEY  # Server admin access
SUPABASE_DB_URL            # Direct database connection
LOVABLE_API_KEY            # AI synopsis generation
```

---

## Deployment

### Frontend Deployment
**Platform:** Lovable.dev (default) or custom hosting
**Build Command:** `npm run build`
**Output Directory:** `dist/`
**Environment:** Production variables in `.env`

### Backend Deployment
**Platform:** Supabase (managed)
**Edge Functions:** Auto-deployed from `supabase/functions/`
**Database:** Managed PostgreSQL instance
**Migrations:** Applied via Supabase CLI or dashboard

### Custom Domain
- Configurable in Lovable project settings
- Requires paid Lovable plan
- DNS configuration required

---

## Performance Considerations

### Frontend Optimization
- Vite for fast builds and HMR
- Code splitting via React.lazy (future enhancement)
- Minimal bundle size with tree-shaking
- Asset optimization

### Backend Optimization
- Edge Functions: Cold start < 1s
- Database indexes on user_id columns
- Connection pooling (Supabase default)

### Content Delivery
- Book content fetched on-demand
- No caching of large text files
- Progressive loading for long books

---

## Future Enhancements

### Planned Features
1. **Social Features**
   - Book reviews and ratings
   - Reading lists sharing
   - Friend connections

2. **Enhanced Reading**
   - Bookmarks and highlights
   - Notes and annotations
   - Text-to-speech integration

3. **Discovery**
   - Personalized recommendations
   - Genre browsing
   - Popular books feed

4. **Mobile**
   - Offline reading support
   - Mobile app (React Native)
   - Push notifications

5. **Analytics**
   - Reading time tracking
   - Reading habits insights
   - Goal setting and achievements

---

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Functional components with hooks
- Props interfaces for all components

### Component Guidelines
- Small, focused components
- Reusable UI components in `src/components/ui/`
- Feature components in `src/components/[feature]/`
- Page components in `src/pages/`

### Database Changes
- Always use migrations
- Never modify `auth` schema
- Test RLS policies thoroughly
- Include rollback scripts

### Testing Strategy
- Manual testing in development
- User acceptance testing
- Edge function testing via Supabase dashboard
- Database security linting

---

## Project Structure

```
gutenberg-reader/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthForm.tsx
│   │   ├── books/
│   │   │   ├── BookReader.tsx
│   │   │   └── BookSearch.tsx
│   │   └── ui/
│   │       └── [shadcn components]
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── pages/
│   │   ├── Index.tsx
│   │   ├── Dashboard.tsx
│   │   └── NotFound.tsx
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── search-books/
│   │   ├── fetch-book-content/
│   │   └── generate-synopsis/
│   └── migrations/
├── public/
├── .env
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## Dependencies Summary

### Core Dependencies
- React 18.3.1 + React DOM
- TypeScript
- Vite
- Supabase JS Client 2.57.4
- React Router DOM 6.30.1
- React Hook Form 7.61.1
- Zod 3.25.76
- TanStack Query 5.83.0

### UI Dependencies
- Tailwind CSS + plugins
- Radix UI primitives
- Lucide React (icons)
- Sonner (toasts)
- next-themes (dark mode)

### Build Tools
- Vite + SWC plugin
- Lovable component tagger
- PostCSS + Autoprefixer

---

## Support & Resources

- **Documentation:** https://docs.lovable.dev/
- **Supabase Docs:** https://supabase.com/docs
- **Gutendex API:** https://gutendex.com/
- **Project Gutenberg:** https://www.gutenberg.org/

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
