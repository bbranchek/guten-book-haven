import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, User } from "lucide-react";

interface Book {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  download_count: number;
  formats: Record<string, string>;
}

interface BookSearchProps {
  onBookSelect: (book: Book) => void;
}

export default function BookSearch({ onBookSelect }: BookSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"title" | "author">("title");
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const searchBooks = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a book title or author name to search.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // Use our Supabase Edge Function to search books
      const { data, error } = await supabase.functions.invoke('search-books', {
        body: { 
          search: searchTerm.trim(),
          type: searchType 
        }
      });
      
      if (error) {
        console.error('Search error:', error);
        const isTemporaryError = data?.isTemporary || error.message?.includes('temporarily') || error.message?.includes('503');
        
        toast({
          title: isTemporaryError ? "Service Temporarily Unavailable" : "Search Error",
          description: error.message || "Unable to search books. Please try again.",
          variant: "destructive",
          duration: isTemporaryError ? 8000 : 5000
        });
        return;
      }
      
      setBooks(data.results || []);
      
      if (!data.results || data.results.length === 0) {
        toast({
          title: "No Results Found",
          description: `No books found for "${searchTerm}". Try a different search term.`
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchBooks();
    }
  };

  const getBookAuthors = (book: Book) => {
    return book.authors.map(author => author.name).join(", ");
  };

  const hasReadableFormat = (book: Book) => {
    return book.formats && (
      book.formats["text/html"] || 
      book.formats["text/plain; charset=utf-8"] ||
      book.formats["text/plain"]
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-[var(--shadow-elegant)] border-2 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-serif text-primary">
            <Search className="h-5 w-5" />
            Search Project Gutenberg
          </CardTitle>
          <div className="mt-4 p-4 bg-primary/10 border-l-4 border-primary rounded">
            <p className="text-sm font-semibold text-primary mb-2">
              📖 How to use chapter navigation:
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Search for a book below</li>
              <li>Click on any book from the results</li>
              <li>The book reader will open with a "Jump to Chapter" input field at the top</li>
            </ol>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={searchType} onValueChange={(value) => setSearchType(value as "title" | "author")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="title" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Book Title
              </TabsTrigger>
              <TabsTrigger value="author" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Author Name
              </TabsTrigger>
            </TabsList>

            <TabsContent value="title" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title-search">Enter Book Title</Label>
                <Input
                  id="title-search"
                  placeholder="e.g., Pride and Prejudice, Moby Dick..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-background/50"
                />
              </div>
            </TabsContent>

            <TabsContent value="author" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="author-search">Enter Author Name</Label>
                <Input
                  id="author-search"
                  placeholder="e.g., Jane Austen, Charles Dickens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-background/50"
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={searchBooks} 
            disabled={isLoading || !searchTerm.trim()}
            className="w-full"
            variant="leather"
          >
            {isLoading ? "Searching..." : `Search by ${searchType === "title" ? "Title" : "Author"}`}
          </Button>

          {/* Animated Loading Ellipse for Book Search */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse [animation-delay:0ms]"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse [animation-delay:150ms]"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse [animation-delay:300ms]"></div>
              </div>
              <span className="ml-3 text-sm text-muted-foreground animate-fade-in">
                Loading books by {searchType}...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif text-primary">
            Search Results {books.length > 0 && `(${books.length} books found)`}
          </h2>
          
          {books.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No books found. Try adjusting your search terms.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {books.map((book) => (
                <Card 
                  key={book.id}
                  className="transition-[var(--transition-elegant)] hover:shadow-[var(--shadow-book)] cursor-pointer border-2 border-border/30 hover:border-primary/20"
                  onClick={() => onBookSelect(book)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <h3 className="font-serif text-lg font-semibold text-primary line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-muted-foreground">
                          by {getBookAuthors(book)}
                        </p>
                        {book.subjects && book.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {book.subjects.slice(0, 3).map((subject, index) => (
                              <span 
                                key={index}
                                className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                              >
                                {subject.split("--")[0]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm text-muted-foreground">
                          {book.download_count.toLocaleString()} downloads
                        </div>
                        {hasReadableFormat(book) ? (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            Available to Read
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                            Limited Formats
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}