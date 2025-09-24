-- Update profiles table to store additional user information for Gutenberg Reader
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reading_preferences JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS books_read INTEGER DEFAULT 0;

-- Create table for user's reading history and bookmarks
CREATE TABLE IF NOT EXISTS public.user_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  gutenberg_id INTEGER NOT NULL,
  book_title TEXT NOT NULL,
  author TEXT,
  status TEXT NOT NULL CHECK (status IN ('reading', 'completed', 'bookmarked', 'want_to_read')) DEFAULT 'bookmarked',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  last_read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, gutenberg_id)
);

-- Enable RLS on user_books table
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

-- Create policies for user_books table
CREATE POLICY "Users can view their own books" 
ON public.user_books 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" 
ON public.user_books 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" 
ON public.user_books 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" 
ON public.user_books 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on user_books
CREATE TRIGGER update_user_books_updated_at
BEFORE UPDATE ON public.user_books
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_books_user_id ON public.user_books(user_id);
CREATE INDEX IF NOT EXISTS idx_user_books_status ON public.user_books(status);
CREATE INDEX IF NOT EXISTS idx_user_books_last_read ON public.user_books(last_read_at DESC);