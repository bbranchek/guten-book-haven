import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BookSearch from "@/components/books/BookSearch";
import BookReader from "@/components/books/BookReader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, BookOpen } from "lucide-react";
import openBookHero from "@/assets/open-book-hero.jpg";

interface Book {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  download_count: number;
  formats: Record<string, string>;
}

interface Profile {
  username: string;
  email?: string;
  books_read: number;
}

interface DashboardProps {
  user: any;
  onSignOut: () => void;
}

export default function Dashboard({ user, onSignOut }: DashboardProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email, books_read')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Sign Out Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out."
      });
      
      onSignOut();
    } catch (error) {
      toast({
        title: "Unexpected Error",
        description: "An error occurred while signing out.",
        variant: "destructive"
      });
    }
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
  };

  const handleBackToSearch = () => {
    setSelectedBook(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary rounded-lg shadow-[var(--shadow-elegant)]">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-primary">
                Gutenberg Project Reader
              </h1>
              <p className="text-sm text-muted-foreground">
                Access thousands of free classic books
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-primary">
                  Welcome, {profile.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile.books_read || 0} books read
                </p>
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}  
      <main className="container mx-auto px-4 py-8">
        {!selectedBook ? (
          <div className="space-y-8">
            {/* Hero Section */}
            <Card className="relative overflow-hidden shadow-[var(--shadow-book)] border-2 border-border/50">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
              <CardContent className="relative p-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <h2 className="text-3xl font-serif font-bold text-primary">
                      Discover Classic Literature
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Explore over 70,000 free books from Project Gutenberg. Search by title or author
                      to find timeless classics, philosophy, science, and literature from around the world.
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Free Books
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Classic Authors
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={openBookHero}
                      alt="Classic open book with elegant pages"
                      className="max-w-full h-auto rounded-lg shadow-[var(--shadow-elegant)]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Section */}
            <BookSearch onBookSelect={handleBookSelect} />
          </div>
        ) : (
          <BookReader 
            book={selectedBook} 
            onBack={handleBackToSearch}
            userId={user?.id}
          />
        )}
      </main>
    </div>
  );
}