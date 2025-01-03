import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "../ui/select";
import { Slider } from "../ui/slider";
import { Search } from 'lucide-react';

export const WikipediaOverlay = () => {
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [highlightedArticle, setHighlightedArticle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(20);
  const [categories, setCategories] = useState(new Set());
  const [locationSearch, setLocationSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const categorizeArticle = (articleCategories) => {
    const groups = {
      landmarks: ['Buildings', 'Architecture', 'Monuments', 'Streets', 'Infrastructure'],
      culture: ['Museums', 'Arts', 'Culture', 'Entertainment', 'Education'],
      history: ['History', 'Heritage', 'Historical', 'Archaeological'],
      nature: ['Parks', 'Gardens', 'Nature', 'Geography', 'Landscape'],
      other: []
    };

    articleCategories.forEach(category => {
      let grouped = false;
      for (const [group, keywords] of Object.entries(groups)) {
        if (keywords.some(keyword => category.includes(keyword))) {
          if (!categoryGroups[group].includes(category)) {
            setCategoryGroups(prev => ({
              ...prev,
              [group]: [...prev[group], category]
            }));
          }
          grouped = true;
          break;
        }
      }
      if (!grouped) {
        setCategoryGroups(prev => ({
          ...prev,
          other: [...new Set([...prev.other, category])]
        }));
      }
    });
  };

  const fetchNearbyArticles = async (lat, lon) => {
    try {
      setLoading(true);
      
      // Define category mappings
      const categoryMappings = {
        landmarks: 'Category:Buildings_and_structures|Category:Monuments_and_memorials|Category:Architecture',
        culture: 'Category:Museums|Category:Cultural_venues|Category:Arts_organizations|Category:Entertainment_venues',
        history: 'Category:Historic_sites|Category:History|Category:Heritage_sites|Category:Archaeological_sites',
        nature: 'Category:Parks|Category:Gardens|Category:Natural_features|Category:Geography'
      };

      // Build API URL with category filter if not "all"
      const params = {
        action: 'query',
        list: 'geosearch',
        gscoord: `${lat}|${lon}`,
        gsradius: '10000',
        gslimit: limit.toString(),
        format: 'json',
        origin: '*'
      };

      // Add category filter if a specific category is selected
      if (selectedCategory !== 'all' && categoryMappings[selectedCategory]) {
        params.gscategories = categoryMappings[selectedCategory];
      }

      const geoUrl = `https://en.wikipedia.org/w/api.php?${new URLSearchParams(params)}`;

      const response = await fetch(geoUrl);
      const data = await response.json();

      if (data.query && data.query.geosearch) {
        const articlesWithDetails = await Promise.all(
          data.query.geosearch.map(async (place) => {
            const detailsUrl = `https://en.wikipedia.org/w/api.php?` +
              new URLSearchParams({
                action: 'query',
                pageids: place.pageid,
                prop: 'extracts|categories|pageimages',
                exintro: '1',
                explaintext: '1',
                piprop: 'thumbnail',
                pithumbsize: 200,
                format: 'json',
                origin: '*'
              });

            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            const page = detailsData.query.pages[place.pageid];
            
            return {
              ...place,
              title: page.title,
              extract: page.extract,
              categories: page.categories?.map(cat => cat.title.replace('Category:', '')) || [],
              direction: getDirection(lat, lon, place.lat, place.lon),
              thumbnail: page.thumbnail?.source || null
            };
          })
        );

        setArticles(articlesWithDetails);
        if (window.addArticleMarkers) {
          window.addArticleMarkers(articlesWithDetails);
        }
      }
    } catch (error) {
      console.error('Error fetching Wikipedia articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDirection = (fromLat, fromLon, toLat, toLon) => {
    const dLat = toLat - fromLat;
    const dLon = toLon - fromLon;
    const angle = Math.atan2(dLon, dLat) * 180 / Math.PI;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((angle + 360) % 360) / 45) % 8;
    return directions[index];
  };

  useEffect(() => {
    if (currentLocation) {
      fetchNearbyArticles(currentLocation.lat, currentLocation.lon);
    }
  }, [selectedCategory, currentLocation, limit]);

  const filteredAndSortedArticles = React.useMemo(() => {
    let filtered = articles;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.extract?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [articles, searchTerm]);

  useEffect(() => {
    const handleMarkerClick = (e) => {
      setHighlightedArticle(e.detail.pageid);
      const articleElement = document.getElementById(`article-${e.detail.pageid}`);
      if (articleElement) {
        articleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('markerClicked', handleMarkerClick);
    return () => window.removeEventListener('markerClicked', handleMarkerClick);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    if (currentLocation) {
      fetchNearbyArticles(currentLocation.lat, currentLocation.lon);
    } else if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        fetchNearbyArticles(position.coords.latitude, position.coords.longitude);
      });
    }
  };

  const searchLocation = async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: query,
          format: 'json',
          limit: '1'
        })
      );
      
      const data = await response.json();
      console.log('Location search result:', data);

      if (data && data[0]) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        setCurrentLocation({ lat: latitude, lon: longitude });
        
        if (window.setMapCenter) {
          window.setMapCenter(latitude, longitude);
        }

        fetchNearbyArticles(latitude, longitude);
        
        setLocationSearch('');
      }
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchWikipedia = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?` +
        new URLSearchParams({
          action: 'opensearch',
          search: searchTerm,
          limit: '10',
          namespace: '0',
          format: 'json',
          origin: '*'
        });

      const response = await fetch(searchUrl);
      const [term, titles, descriptions, urls] = await response.json();
      
      const results = titles.map((title, index) => ({
        title,
        description: descriptions[index],
        url: urls[index]
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = React.useCallback(
    debounce((term) => searchWikipedia(term), 300),
    []
  );

  const fetchArticleLocation = async (title) => {
    try {
      setLoading(true);
      const geoUrl = `https://en.wikipedia.org/w/api.php?` + 
        new URLSearchParams({
          action: 'query',
          titles: title,
          prop: 'coordinates|extracts|categories|pageimages',
          exintro: '1',
          explaintext: '1',
          piprop: 'thumbnail',
          pithumbsize: 200,
          format: 'json',
          origin: '*'
        });

      const response = await fetch(geoUrl);
      const data = await response.json();
      const page = Object.values(data.query.pages)[0];
      
      if (page.coordinates) {
        const { lat, lon } = page.coordinates[0];
        
        // Update location first
        setCurrentLocation({ lat, lon });
        
        // Update map center
        if (window.setMapCenter) {
          window.setMapCenter(lat, lon, 15);
        }

        // Fetch nearby articles immediately
        await fetchNearbyArticles(lat, lon);

        // Highlight the searched article after nearby articles are loaded
        setHighlightedArticle(page.pageid);
        if (window.highlightMarker) {
          window.highlightMarker(page.pageid);
        }
      }
    } catch (error) {
      console.error('Error fetching article location:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed right-4 top-4 w-96 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 max-h-[90vh] overflow-hidden z-[1000]">
      <CardHeader className="border-b space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>WikiMaps 🌎</CardTitle>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`${loading ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </Button>
        </div>

        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
          <label className="text-xs font-medium mb-1 block">
            Lcoation Search
          </label>
            <Input
              placeholder="e.g., 'Eiffel Tower' or 'Times Square, NYC'"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchLocation(locationSearch);
                }
              }}
              className="pr-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-[28px] h-[calc(100%-28px)]"
              onClick={() => searchLocation(locationSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <label className="text-xs font-medium mb-1 block">
            Article Search
          </label>
          <Input
            placeholder="e.g., 'Statue of Liberty' or 'Big Ben'"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              debouncedSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault();
                fetchArticleLocation(searchResults[0].title);
                setSearchResults([]);
                setSearchTerm('');
              }
            }}
            className="w-full"
          />
          {isSearching && (
            <div className="absolute right-2 top-[calc(50%+14px)] transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
          
          {searchResults.length > 0 && searchTerm && (
            <Card className="absolute w-full mt-1 z-50 max-h-[300px] overflow-auto">
              <CardContent className="p-2">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-accent cursor-pointer rounded"
                    onClick={() => {
                      fetchArticleLocation(result.title);
                      setSearchResults([]); // Clear search results
                      setSearchTerm(''); // Clear search input
                    }}
                  >
                    <h4 className="font-medium">{result.title}</h4>
                    {result.description && (
                      <p className="text-sm text-muted-foreground">
                        {result.description}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-2"><label className="text-xs font-medium mb-1 block">
            Category
          </label>
          <div className="flex gap-2">
          
            <Select value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
              <SelectTrigger>
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent className="z-[1001]">
                <SelectItem value="all">All Places</SelectItem>
                <SelectGroup>
                  <SelectItem value="landmarks">Landmarks</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectItem value="culture">Culture</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectItem value="history">History</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectItem value="nature">Nature</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">Results Limit: {limit}</label>
            <Slider
              value={[limit]}
              onValueChange={([value]) => {
                setLimit(value);
                setLoading(true);
              }}
              min={10}
              max={50}
              step={5}
              disabled={loading}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-auto max-h-[calc(90vh-120px)]">
        {!currentLocation ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <p className="mb-4">Search for a location to see nearby Wikipedia articles</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {filteredAndSortedArticles.map(article => (
              <Card 
                key={article.pageid}
                id={`article-${article.pageid}`}
                className={`p-4 hover:bg-accent transition-colors cursor-pointer ${
                  highlightedArticle === article.pageid ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  setHighlightedArticle(article.pageid);
                  if (window.highlightMarker) {
                    window.highlightMarker(article.pageid);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {article.thumbnail && (
                    <div className="flex-shrink-0 w-24 h-24">
                      <img 
                        src={article.thumbnail} 
                        alt={article.title}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{article.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                        {article.direction}
                      </span>
                      <span>{Math.round(article.dist)}m away</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2" 
                       dangerouslySetInnerHTML={{ __html: article.extract?.substring(0, 150) + '...' }} />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button 
                    variant="link" 
                    className="text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://en.wikipedia.org/?curid=${article.pageid}`, '_blank');
                    }}
                  >
                    Read More →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WikipediaOverlay; 