# Gutenberg Project Reader

A modern web application for discovering and reading classic literature from Project Gutenberg. Features secure user authentication, personal reading profiles, and access to over 70,000 free books.

## Project info

**URL**: https://lovable.dev/projects/9b56a6c6-0825-4b24-b41a-e145196fb829

## 📚 Features

- **User Authentication**: Secure sign-up and sign-in with email verification
- **Personal Profiles**: Track reading progress and maintain reading history
- **Book Discovery**: Search through thousands of classic books by title or author
- **Reading Interface**: Clean, distraction-free reading experience
- **Progress Tracking**: Bookmark and track reading progress across multiple books
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 🔐 Authentication System

### User Registration & Sign-In
The application uses Supabase authentication with the following features:

- **Email/Password Authentication**: Users register with username, email, and password
- **Email Verification**: New accounts require email verification for security
- **Input Validation**: Client-side validation using Zod schemas for data integrity
- **Secure Sessions**: Automatic session management and token refresh
- **Profile Creation**: Automatic user profile creation upon registration

### User Profiles
Each user gets a personal profile with:
- **Username**: Display name chosen during registration
- **Reading Statistics**: Track total books read
- **Reading History**: Personal library of bookmarked and read books
- **Progress Tracking**: Save reading position across sessions

### Security Features
- **Row Level Security (RLS)**: Database policies ensure users only access their own data
- **Input Sanitization**: All user inputs are validated and sanitized
- **Secure Password Handling**: Passwords are encrypted and handled by Supabase Auth
- **Session Management**: Automatic token refresh and secure session storage

### Database Schema
The application uses two main tables:

**profiles table:**
- `id`: Unique identifier (UUID)
- `user_id`: Reference to authenticated user
- `username`: User's display name
- `email`: User's email address
- `books_read`: Count of completed books
- `bio`: Optional user biography
- `reading_preferences`: JSON field for user preferences
- `created_at` / `updated_at`: Timestamps

**user_books table:**
- `id`: Unique identifier (UUID)
- `user_id`: Reference to book owner
- `book_title`: Title of the book
- `author`: Book author name
- `gutenberg_id`: Project Gutenberg book ID
- `status`: Reading status (bookmarked, reading, completed)
- `progress`: Reading progress percentage
- `last_read_at`: Last reading session timestamp
- `created_at` / `updated_at`: Timestamps

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/9b56a6c6-0825-4b24-b41a-e145196fb829) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🛠️ What technologies are used for this project?

This project is built with:

**Frontend:**
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework with custom design system
- **shadcn-ui** - Beautiful and accessible UI components

**Backend & Database:**
- **Supabase** - Backend-as-a-Service with PostgreSQL database
- **Supabase Auth** - User authentication and session management
- **Row Level Security (RLS)** - Database-level security policies

**Validation & Forms:**
- **Zod** - TypeScript-first schema validation
- **React Hook Form** - Performant forms with easy validation

**UI & Icons:**
- **Lucide React** - Beautiful SVG icons
- **Radix UI** - Unstyled, accessible UI primitives
- **CSS Custom Properties** - Design system with semantic tokens

## 🚀 Getting Started

### For Users

1. **Visit the Application**: Go to the [live application](https://lovable.dev/projects/9b56a6c6-0825-4b24-b41a-e145196fb829)

2. **Create an Account**:
   - Click "Sign Up" on the authentication page
   - Enter your username, email, and password (minimum 6 characters)
   - Check your email for verification link
   - Return to the app and sign in

3. **Start Reading**:
   - Use the search feature to find books by title or author
   - Click on any book to start reading
   - Your progress is automatically saved
   - Access your reading history from your profile

### For Developers

#### Prerequisites
- Node.js 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Git for version control

#### Local Development Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

#### Supabase Configuration

This project is already connected to a Supabase backend. The configuration is handled automatically through:
- **Database**: Pre-configured tables with RLS policies
- **Authentication**: Email/password authentication enabled
- **Edge Functions**: Book search and content fetching APIs

#### Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── books/          # Book-related components
│   └── ui/             # Reusable UI components
├── pages/              # Main application pages
├── integrations/       # Supabase integration
├── hooks/              # Custom React hooks
└── lib/                # Utility functions

supabase/
├── functions/          # Edge functions
└── migrations/         # Database migrations
```

## 🔧 Authentication Setup Guide

### Email Configuration
The application requires email verification for new users. To disable this during development:

1. Visit [Supabase Dashboard > Authentication > Settings](https://supabase.com/dashboard/project/jnttwzuqutvsfrhpnwrz/auth/providers)
2. Disable "Confirm email" under Email Auth settings
3. This speeds up testing but should be re-enabled for production

### Security Recommendations
- **Enable Leaked Password Protection**: Go to Authentication > Settings in Supabase Dashboard
- **Review RLS Policies**: Database policies ensure users only access their own data
- **Monitor Auth Logs**: Check Edge Function logs for authentication issues

## 📖 API & Edge Functions

The application uses Supabase Edge Functions for external API integration:

### Available Functions

**search-books**
- **Purpose**: Search Project Gutenberg catalog
- **Endpoint**: `/functions/v1/search-books`
- **Parameters**: `query` (string) - search term for title/author
- **Returns**: Array of book objects with metadata

**fetch-book-content**
- **Purpose**: Retrieve book content for reading
- **Endpoint**: `/functions/v1/fetch-book-content`
- **Parameters**: `bookId` (number) - Project Gutenberg book ID
- **Returns**: Book content in readable format

### Authentication Flow

1. **Registration**: `supabase.auth.signUp()` with email verification
2. **Profile Creation**: Automatic trigger creates user profile
3. **Session Management**: Automatic token refresh and persistence
4. **Sign Out**: `supabase.auth.signOut()` clears session

## 🏗️ Development Guidelines

### Adding New Features
- Follow the existing component structure in `src/components/`
- Use TypeScript for all new files
- Implement proper error handling and loading states
- Add appropriate RLS policies for new database tables

### Database Changes
- Create migrations using Supabase Dashboard or SQL editor
- Always include RLS policies for user-specific data
- Test migrations in development before deploying

### UI Components
- Use existing shadcn-ui components when possible
- Follow the design system tokens defined in `src/index.css`
- Ensure responsive design and accessibility compliance

### Security Best Practices
- Validate all user inputs using Zod schemas
- Use RLS policies instead of client-side filtering
- Never expose sensitive data in client-side code
- Test authentication flows thoroughly

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/9b56a6c6-0825-4b24-b41a-e145196fb829) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
