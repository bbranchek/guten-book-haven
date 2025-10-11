import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BookOpen, Download, Bookmark, BookmarkCheck, Sparkles, Play, Pause, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [fullBookContent, setFullBookContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [synopsis, setSynopsis] = useState<string>("");
  const [isSynopsisLoading, setIsSynopsisLoading] = useState(false);
  const [chapterInput, setChapterInput] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isStoppedIntentionally = useRef(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [readAloudSource, setReadAloudSource] = useState<'book' | 'synopsis'>('book');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  // Load voices for Android compatibility
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        setVoicesLoaded(true);
      }
    };

    if (window.speechSynthesis) {
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

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

      const trimmedContent = content.trim();
      setFullBookContent(trimmedContent);
      
      // Automatically jump to the first chapter
      await jumpToFirstChapter(trimmedContent);
      
      } catch (error) {
        console.error('Book loading error:', error);
        toast({
          title: "Loading Error",
          description: error instanceof Error ? error.message : "Unable to load book content. Please try a different format.",
          variant: "destructive"
        });
      } finally {
      setIsLoading(false);
    }
  };

  const jumpToFirstChapter = async (content: string) => {
    // Find the first chapter in various formats
    const chapterPatterns: RegExp[] = [
      /\n\s*CHAPTER\s+(?:I|1|One|ONE)\b/i,
      /\n\s*Chapter\s+(?:I|1|One)\b/i,
      /\n\s*(?:I|1)\.\s*$/m,
      /\n\s*(?:I|1)\s*$/m
    ];

    const allMatches: Array<{index: number, pattern: string, score: number}> = [];

    for (const pattern of chapterPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        if (match.index !== undefined) {
          // Score based on prose content that follows
          const testText = content.substring(match.index, match.index + 1000);
          
          const lines = testText.split('\n');
          let proseScore = 0;
          
          for (let i = 1; i < Math.min(lines.length, 15); i++) {
            const lineLength = lines[i].trim().length;
            if (lineLength > 60) {
              proseScore += 2;
            } else if (lineLength > 30) {
              proseScore += 1;
            }
          }
          
          const hasMultipleParagraphs = testText.split('\n\n').length > 1;
          const hasLongSentences = /[.!?]\s+[A-Za-z]+/.test(testText);
          
          if (hasMultipleParagraphs) proseScore += 5;
          if (hasLongSentences) proseScore += 3;
          
          allMatches.push({
            index: match.index,
            pattern: match[0],
            score: proseScore
          });
        }
      }
    }

    if (allMatches.length === 0) {
      // If no chapters found, just show the beginning of the book
      setBookContent(content.substring(0, Math.min(10000, content.length)));
      toast({
        title: "Book Loaded",
        description: "No chapters detected. Showing book content.",
      });
      return;
    }

    // Get the best match (highest score = most likely the actual chapter, not TOC)
    allMatches.sort((a, b) => b.score - a.score);
    const bestMatch = allMatches[0];

    // Find the end of the first chapter
    const nextChapterPatterns: RegExp[] = [
      /\n\s*CHAPTER\s+(?:II|2|Two|TWO)\b/i,
      /\n\s*Chapter\s+(?:II|2|Two)\b/i,
      /\n\s*(?:II|2)\.\s*$/m,
      /\n\s*(?:II|2)\s*$/m
    ];

    const contentFromStart = content.substring(bestMatch.index);
    let chapterEndIndex = contentFromStart.length;

    for (const pattern of nextChapterPatterns) {
      const match = contentFromStart.match(pattern);
      if (match && match.index !== undefined && match.index > 300) {
        chapterEndIndex = match.index;
        break;
      }
    }

    const chapterContent = contentFromStart.substring(0, chapterEndIndex).trim();
    setBookContent(chapterContent);
    
    toast({
      title: "Book Loaded",
      description: "Starting at Chapter 1.",
    });
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

  const romanToInt = (roman: string): number => {
    const romanMap: Record<string, number> = {
      'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000
    };
    
    let result = 0;
    const upperRoman = roman.toUpperCase().trim();
    
    for (let i = 0; i < upperRoman.length; i++) {
      const current = romanMap[upperRoman[i]];
      const next = romanMap[upperRoman[i + 1]];
      
      if (!current) {
        throw new Error('Invalid Roman numeral');
      }
      
      if (next && current < next) {
        result -= current;
      } else {
        result += current;
      }
    }
    
    return result;
  };

  const jumpToChapter = () => {
    if (!chapterInput.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a chapter number (e.g., I, II, III, or 1, 2, 3).",
        variant: "destructive"
      });
      return;
    }

    if (!fullBookContent) {
      toast({
        title: "Load Book First",
        description: "Please load the book content before jumping to a chapter.",
        variant: "destructive"
      });
      return;
    }

    try {
      let chapterNum: number;
      let romanNumeral: string;
      let searchInput = chapterInput.trim();
      
      // Check if input is in "Chapter X" format
      const chapterMatch = searchInput.match(/^chapter\s*(\d+|[ivxlcdm]+)$/i);
      if (chapterMatch) {
        searchInput = chapterMatch[1];
      }
      
      // Try to parse as regular number first
      const numericMatch = searchInput.match(/^\d+$/);
      if (numericMatch) {
        chapterNum = parseInt(searchInput, 10);
        romanNumeral = ""; // Will use numeric patterns
      } else {
        // Try to parse as Roman numeral
        chapterNum = romanToInt(searchInput);
        romanNumeral = searchInput.toUpperCase();
      }
      
      // Build all possible chapter patterns
      const allChapterPatterns: RegExp[] = [];
      
      if (romanNumeral) {
        // Roman numeral patterns - various formats
        allChapterPatterns.push(
          new RegExp(`\\n\\s*CHAPTER\\s+${romanNumeral}\\b`, 'gi'),
          new RegExp(`\\n\\s*Chapter\\s+${romanNumeral}\\b`, 'gi'),
          new RegExp(`\\n\\s*${romanNumeral}\\.\\s*$`, 'gim'),  // Roman numeral with period at end of line
          new RegExp(`\\n\\s*${romanNumeral}\\s*$`, 'gim')      // Just Roman numeral on its own line
        );
      }
      
      // Standard number patterns
      allChapterPatterns.push(
        new RegExp(`\\n\\s*CHAPTER\\s+${chapterNum}\\b`, 'gi'),
        new RegExp(`\\n\\s*Chapter\\s+${chapterNum}\\b`, 'gi'),
        new RegExp(`\\n\\s*${chapterNum}\\.\\s*$`, 'gim'),
        new RegExp(`\\n\\s*${chapterNum}\\s*$`, 'gim')
      );

      // Find ALL matches for the requested chapter
      const allMatches: Array<{index: number, pattern: string, score: number}> = [];
      
      for (const pattern of allChapterPatterns) {
        const matches = Array.from(fullBookContent.matchAll(pattern));
        for (const match of matches) {
          if (match.index !== undefined) {
            // Score each match based on how much prose content follows it
            const testText = fullBookContent.substring(match.index, match.index + 1000);
            
            // Count substantial lines (prose paragraphs, not TOC entries)
            const lines = testText.split('\n');
            let proseScore = 0;
            
            for (let i = 1; i < Math.min(lines.length, 15); i++) {
              const lineLength = lines[i].trim().length;
              if (lineLength > 60) {
                proseScore += 2; // Long lines are likely prose
              } else if (lineLength > 30) {
                proseScore += 1; // Medium lines might be prose
              }
            }
            
            // Check for indicators this is actual content, not TOC
            const hasMultipleParagraphs = testText.split('\n\n').length > 2;
            const hasLongSentences = /[.!?]\s+[A-Z]/.test(testText);
            
            if (hasMultipleParagraphs) proseScore += 5;
            if (hasLongSentences) proseScore += 3;
            
            allMatches.push({
              index: match.index,
              pattern: match[0],
              score: proseScore
            });
          }
        }
      }
      
      if (allMatches.length === 0) {
        toast({
          title: "Chapter Not Found",
          description: `Could not find chapter ${chapterInput} in the book.`,
          variant: "destructive"
        });
        return;
      }
      
      // Sort by score (highest first) - the match with most prose content is likely the real chapter
      allMatches.sort((a, b) => b.score - a.score);
      
      const bestMatch = allMatches[0];
      const chapterIndex = bestMatch.index;
      const matchedPattern = bestMatch.pattern;

      // Find the end of this chapter (start of next chapter or end of book)
      const nextChapterPatterns = [
        /\n\s*CHAPTER\s+[IVXLCDM]+\b/gi,
        /\n\s*Chapter\s+[IVXLCDM]+\b/gi,
        /\n\s*CHAPTER\s+\d+\b/gi,
        /\n\s*Chapter\s+\d+\b/gi,
        /\n\s*[IVXLCDM]+\.\s*$/gim,
        /\n\s*[IVXLCDM]+\s*$/gim,
        /\n\s*\d+\.\s*$/gim
      ];
      
      const contentFromChapterStart = fullBookContent.substring(chapterIndex + matchedPattern.length);
      let chapterEndIndex = contentFromChapterStart.length;
      
      // Look for the next chapter marker
      for (const pattern of nextChapterPatterns) {
        const nextMatch = contentFromChapterStart.match(pattern);
        if (nextMatch && nextMatch.index !== undefined && nextMatch.index > 300) {
          // Only consider it the next chapter if it's at least 300 chars away
          chapterEndIndex = nextMatch.index;
          break;
        }
      }
      
      const chapterContent = contentFromChapterStart.substring(0, chapterEndIndex).trim();
      setBookContent(chapterContent);
      
      toast({
        title: "Chapter Found",
        description: `Displaying chapter ${chapterInput}.`
      });
      
      setChapterInput("");
    } catch (error: any) {
      toast({
        title: "Invalid Input",
        description: error.message || "Please enter a valid chapter number.",
        variant: "destructive"
      });
    }
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

  const startReading = () => {
    const contentToRead = readAloudSource === 'synopsis' ? synopsis : bookContent;
    
    if (!contentToRead) {
      toast({
        title: "No Content",
        description: `Please ${readAloudSource === 'synopsis' ? 'generate a synopsis' : 'load the book content'} first.`,
        variant: "destructive"
      });
      return;
    }

    if (!window.speechSynthesis) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive"
      });
      return;
    }

    // Stop any existing speech
    window.speechSynthesis.cancel();

    // Small delay for Android compatibility
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(contentToRead);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Get available voices and set one explicitly for Android
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Try to find an English voice, fallback to first available
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        utterance.voice = englishVoice || voices[0];
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        isStoppedIntentionally.current = false;
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        if (!isStoppedIntentionally.current) {
          toast({
            title: "Reading Complete",
            description: "Finished reading the content."
          });
        }
        isStoppedIntentionally.current = false;
        utteranceRef.current = null;
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        setIsSpeaking(false);
        setIsPaused(false);
        // Suppress error if it was intentionally stopped (canceled/interrupted)
        if (!isStoppedIntentionally.current && event.error !== 'canceled' && event.error !== 'interrupted') {
          toast({
            title: "Reading Error",
            description: "An error occurred while reading.",
            variant: "destructive"
          });
        }
        isStoppedIntentionally.current = false;
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  const pauseReading = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resumeReading = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const stopReading = () => {
    isStoppedIntentionally.current = true;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
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
                    {synopsis && (
                      <Select value={readAloudSource} onValueChange={(value: 'book' | 'synopsis') => setReadAloudSource(value)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="book">Read Book</SelectItem>
                          <SelectItem value="synopsis">Read Synopsis</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {!isSpeaking ? (
                      <Button
                        variant="outline"
                        onClick={startReading}
                        disabled={!bookContent && !synopsis}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Read Aloud
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        {!isPaused ? (
                          <Button
                            variant="outline"
                            onClick={pauseReading}
                            className="flex items-center gap-2"
                          >
                            <Pause className="h-4 w-4" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={resumeReading}
                            className="flex items-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Resume
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={stopReading}
                          className="flex items-center gap-2"
                        >
                          <Square className="h-4 w-4" />
                          Stop
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 p-4 bg-card border-2 border-primary/20 rounded-lg shadow-sm">
                  <label htmlFor="chapter-input" className="text-sm font-semibold text-primary">
                    Jump to Chapter:
                  </label>
                  <input
                    id="chapter-input"
                    type="text"
                    value={chapterInput}
                    onChange={(e) => setChapterInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fullBookContent && jumpToChapter()}
                    placeholder="I, II, or Chapter 1..."
                    disabled={!fullBookContent}
                    className="flex h-10 w-40 rounded-md border-2 border-primary/30 bg-background px-3 py-2 text-base font-medium shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    maxLength={20}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={jumpToChapter}
                    disabled={!chapterInput.trim() || !fullBookContent}
                    className="font-semibold"
                  >
                    Go
                  </Button>
                  {!fullBookContent && (
                    <span className="text-sm text-muted-foreground font-medium">(Load book first)</span>
                  )}
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