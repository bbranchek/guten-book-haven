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

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Gutenberg-Reader/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Gutendx API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch books: ${response.statusText}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log(`Found ${data.results?.length || 0} books`);

    // Filter results by search type if needed
    let filteredResults = data.results || [];
    
    if (searchType === 'author' && filteredResults.length > 0) {
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

    // Remove duplicates based on book ID
    const uniqueBooks = new Map();
    filteredResults.forEach((book: any) => {
      if (!uniqueBooks.has(book.id)) {
        uniqueBooks.set(book.id, book);
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