import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Download, Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Book {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  download_count: number;
  formats: Record<string, string>;
}

interface BookReaderProps {
  book: Book;
  onBack: () => void;
  userId?: string;
}

export default function BookReader({ book, onBack, userId }: BookReaderProps) {
  const [bookContent, setBookContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [synopsis, setSynopsis] = useState<string>("");
  const [isSynopsisLoading, setIsSynopsisLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      checkIfBookmarked();
    }
  }, [book.id, userId]);

  const checkIfBookmarked = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('user_books')
        .select('id')
        .eq('user_id', userId)
        .eq('gutenberg_id', book.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking bookmark:', error);
        return;
      }

      setIsBookmarked(!!data);
    } catch (error) {
      console.error('Error checking bookmark:', error);
    }
  };

  const toggleBookmark = async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to bookmark books.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsBookmarkLoading(true);

      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('user_books')
          .delete()
          .eq('user_id', userId)
          .eq('gutenberg_id', book.id);

        if (error) throw error;

        setIsBookmarked(false);
        toast({
          title: "Bookmark Removed",
          description: "Book removed from your library."
        });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('user_books')
          .insert({
            user_id: userId,
            gutenberg_id: book.id,
            book_title: book.title,
            author: book.authors.map(a => a.name).join(", "),
            status: 'bookmarked'
          });

        if (error) throw error;

        setIsBookmarked(true);
        toast({
          title: "Book Bookmarked",
          description: "Book added to your library."
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update bookmark.",
        variant: "destructive"
      });
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const loadBookContent = async (format: string, url: string) => {
    try {
      setIsLoading(true);
      setBookContent("");

      // Use our proxy edge function to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('fetch-book-content', {
        body: { url }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch book content');
      }

      let content = data.content;

      // Clean up HTML content for better reading
      if (format.includes("html")) {
        // Remove HTML tags for a cleaner reading experience
        content = content
          .replace(/<style[^>]*>.*?<\/style>/gis, '')
          .replace(/<script[^>]*>.*?<\/script>/gis, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Clean up common Project Gutenberg headers/footers
      const startMarkers = [
        "*** START OF THE PROJECT GUTENBERG EBOOK",
        "*** START OF THIS PROJECT GUTENBERG EBOOK"
      ];
      
      const endMarkers = [
        "*** END OF THE PROJECT GUTENBERG EBOOK",
        "*** END OF THIS PROJECT GUTENBERG EBOOK"
      ];

      for (const marker of startMarkers) {
        const startIndex = content.indexOf(marker);
        if (startIndex !== -1) {
          const lineEnd = content.indexOf('\n', startIndex);
          if (lineEnd !== -1) {
            content = content.substring(lineEnd + 1);
          }
        }
      }

      for (const marker of endMarkers) {
        const endIndex = content.indexOf(marker);
        if (endIndex !== -1) {
          content = content.substring(0, endIndex);
        }
      }

      setBookContent(content.trim());
      
    } catch (error) {
      toast({
        title: "Loading Error",
        description: "Unable to load book content. Please try a different format.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBestReadableFormat = () => {
    // Priority: US-ASCII plain text first, then other formats
    if (book.formats["text/plain; charset=us-ascii"]) {
      return { name: "Plain Text", url: book.formats["text/plain; charset=us-ascii"], key: "txt-ascii" };
    }
    if (book.formats["text/plain"]) {
      return { name: "Plain Text", url: book.formats["text/plain"], key: "txt" };
    }
    if (book.formats["text/plain; charset=utf-8"]) {
      return { name: "Plain Text (UTF-8)", url: book.formats["text/plain; charset=utf-8"], key: "txt-utf8" };
    }
    if (book.formats["text/html"]) {
      return { name: "HTML", url: book.formats["text/html"], key: "html" };
    }
    return null;
  };

  const getAuthors = () => {
    return book.authors.map(author => {
      let name = author.name;
      if (author.birth_year || author.death_year) {
        name += ` (${author.birth_year || '?'}-${author.death_year || '?'})`;
      }
      return name;
    }).join(", ");
  };

  const generateSynopsis = async () => {
    if (!bookContent) {
      toast({
        title: "Load Book First",
        description: "Please load the book content before generating a synopsis.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSynopsisLoading(true);
      setSynopsis("");

      // Take first ~5000 characters of the book for synopsis
      const excerpt = bookContent.slice(0, 5000);

      const { data, error } = await supabase.functions.invoke('generate-synopsis', {
        body: {
          bookTitle: book.title,
          author: getAuthors(),
          excerpt: excerpt
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate synopsis');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSynopsis(data.synopsis);
      
      toast({
        title: "Synopsis Generated",
        description: "AI synopsis has been generated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate synopsis.",
        variant: "destructive"
      });
    } finally {
      setIsSynopsisLoading(false);
    }
  };

  const bestFormat = getBestReadableFormat();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Button>
        <h1 className="text-2xl font-serif text-primary font-bold">Book Reader</h1>
      </div>

      <Card className="shadow-[var(--shadow-book)] border-2 border-border/50">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl font-serif text-primary mb-2">
                {book.title}
              </CardTitle>
              <p className="text-muted-foreground mb-3">by {getAuthors()}</p>
              
              {book.subjects && book.subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {book.subjects.slice(0, 5).map((subject, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {subject.split("--")[0]}
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Downloaded {book.download_count.toLocaleString()} times from Project Gutenberg
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBookmark}
                disabled={isBookmarkLoading}
                className="flex items-center gap-2"
              >
                {isBookmarked ? (
                  <>
                    <BookmarkCheck className="h-4 w-4" />
                    Bookmarked
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    Bookmark
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!bestFormat ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>This book doesn't have readable text formats available.</p>
              <p className="text-sm mt-2">Try downloading other formats if available.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary">Read Book:</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="parchment"
                      onClick={() => loadBookContent(bestFormat.key, bestFormat.url)}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                    {bookContent ? 'Reload Text' : 'Load Text'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={generateSynopsis}
                    disabled={isSynopsisLoading || !bookContent}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Synopsis
                  </Button>
                  </div>
                </div>
              </div>

              {isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading book content...</p>
                </div>
              )}

              {isSynopsisLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Generating AI synopsis...</p>
                </div>
              )}

              {synopsis && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg font-serif flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      AI-Generated Synopsis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-foreground">
                      <p className="leading-relaxed">{synopsis}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {bookContent && (
                <Card className="bg-secondary/30 border-secondary">
                  <CardHeader>
                    <CardTitle className="text-lg font-serif">Reading: {book.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
                      <div className="whitespace-pre-wrap font-serif text-sm leading-7">
                        {bookContent}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}