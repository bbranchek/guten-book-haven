import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let searchTerm: string | null;
    let searchType: string;

    if (req.method === 'POST') {
      // Handle POST request from supabase.functions.invoke
      const body = await req.json();
      searchTerm = body.search;
      searchType = body.type || 'title';
    } else {
      // Handle GET request with URL parameters
      const url = new URL(req.url);
      searchTerm = url.searchParams.get('search');
      searchType = url.searchParams.get('type') || 'title';
    }

    if (!searchTerm) {
      return new Response(
        JSON.stringify({ error: 'Search term is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Searching for: "${searchTerm}" by ${searchType}`);

    let apiUrl: string;
    
    if (searchType === 'author') {
      // For author search, we'll search in the general search but could enhance this
      apiUrl = `https://gutendex.com/books/?search=${encodeURIComponent(searchTerm)}`;
    } else {
      // For title search
      apiUrl = `https://gutendex.com/books/?search=${encodeURIComponent(searchTerm)}`;
    }

    console.log(`Making request to: ${apiUrl}`);

    // Retry logic for external API failures
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Gutenberg-Reader/1.0'
          }
        });

        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        lastError = `${response.status} ${response.statusText}`;
        console.error(`Gutendex API error (attempt ${attempt}/${maxRetries}): ${lastError}`);
        
        // Don't retry on client errors (4xx), only on server errors (5xx)
        if (response.status < 500) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Network error';
        console.error(`Fetch error (attempt ${attempt}/${maxRetries}):`, lastError);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!response || !response.ok) {
      const userMessage = response?.status === 503 
        ? 'The Project Gutenberg API is temporarily unavailable. Please try again in a few moments.'
        : `Unable to search books at this time. ${lastError || 'Please try again later.'}`;
      
      return new Response(
        JSON.stringify({ 
          error: userMessage,
          isTemporary: true
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log(`Found ${data.results?.length || 0} books`);

    // Filter results by search type if needed
    let filteredResults = data.results || [];
    
    if (searchType === 'title' && filteredResults.length > 0) {
      // Filter to only include books where the title actually contains the search term
      const searchLower = searchTerm.toLowerCase();
      filteredResults = filteredResults.filter((book: any) => {
        return book.title && book.title.toLowerCase().includes(searchLower);
      });
    } else if (searchType === 'author' && filteredResults.length > 0) {
      // Filter to prioritize books where the author name matches better
      const searchLower = searchTerm.toLowerCase();
      filteredResults = filteredResults.filter((book: any) => {
        return book.authors && book.authors.some((author: any) => 
          author.name.toLowerCase().includes(searchLower)
        );
      });
      
      // If no author matches found, fall back to original results
      if (filteredResults.length === 0) {
        filteredResults = data.results;
      }
    }

    // Remove duplicates based on title and author, prioritizing readable formats
    const uniqueBooks = new Map();
    filteredResults.forEach((book: any) => {
      const titleKey = book.title.toLowerCase().trim();
      const authorKey = book.authors?.map((a: any) => a.name).join(', ').toLowerCase() || '';
      const bookKey = `${titleKey}|||${authorKey}`;
      
      const existing = uniqueBooks.get(bookKey);
      if (!existing) {
        uniqueBooks.set(bookKey, book);
      } else {
        // Prioritize text formats over audio formats
        const hasReadableFormat = book.formats && (
          book.formats["text/plain; charset=us-ascii"] ||
          book.formats["text/plain; charset=utf-8"] ||
          book.formats["text/plain"] ||
          book.formats["text/html"]
        );
        
        const existingHasReadableFormat = existing.formats && (
          existing.formats["text/plain; charset=us-ascii"] ||
          existing.formats["text/plain; charset=utf-8"] ||
          existing.formats["text/plain"] ||
          existing.formats["text/html"]
        );
        
        // Replace if current book has readable format and existing doesn't
        // Or if both have readable formats but current has higher download count
        if (hasReadableFormat && !existingHasReadableFormat) {
          uniqueBooks.set(bookKey, book);
        } else if (hasReadableFormat && existingHasReadableFormat && book.download_count > existing.download_count) {
          uniqueBooks.set(bookKey, book);
        }
      }
    });
    
    const deduplicatedResults = Array.from(uniqueBooks.values());

    const result = {
      ...data,
      results: deduplicatedResults
    };

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in search-books function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})