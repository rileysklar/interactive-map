import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "../ui/select";
import { Slider } from "../ui/slider";
import { Search, ChevronUp, ChevronDown, X, MapPin } from 'lucide-react';

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
  const [radius, setRadius] = useState(10000);
  const [isExpanded, setIsExpanded] = useState(false);

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
      
      const validRadius = Math.min(Math.max(radius, 100), 10000);
      console.log(`Searching with radius: ${validRadius}m and category: ${selectedCategory}`);
      
      // Build base API URL
      const params = {
        action: 'query',
        list: 'geosearch',
        gscoord: `${lat}|${lon}`,
        gsradius: validRadius.toString(),
        gslimit: '500',
        format: 'json',
        origin: '*'
      };

      // Add category filter if not "all"
      if (selectedCategory !== 'all') {
        const categoryMap = {
          landmarks: 'Category:Buildings_and_structures|Category:Monuments_and_memorials|Category:Landmarks',
          culture: 'Category:Museums|Category:Cultural_institutions|Category:Arts_centers',
          history: 'Category:Historic_sites|Category:Archaeological_sites|Category:Heritage_sites',
          nature: 'Category:Parks|Category:Gardens|Category:Protected_areas'
        };

        if (categoryMap[selectedCategory]) {
          params.gscategories = categoryMap[selectedCategory];
          console.log('Using category filter:', params.gscategories);
        }
      }

      const geoUrl = `https://en.wikipedia.org/w/api.php?${new URLSearchParams(params)}`;
      console.log('Making API request:', geoUrl);

      const response = await fetch(geoUrl);
      const data = await response.json();

      if (data.query && data.query.geosearch) {
        console.log(`Found ${data.query.geosearch.length} articles for category ${selectedCategory}`);
        
        const articlesWithDetails = await Promise.all(
          data.query.geosearch.map(async (place) => {
            const detailsUrl = `https://en.wikipedia.org/w/api.php?` +
              new URLSearchParams({
                action: 'query',
                pageids: place.pageid,
                prop: 'extracts|categories|pageimages|coordinates',
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
              thumbnail: page.thumbnail?.source || null,
              dist: Math.round(getDistance(lat, lon, place.lat, place.lon)),
              searchRadius: validRadius
            };
          })
        );

        // Sort by distance and limit to user-specified limit
        const sortedArticles = articlesWithDetails
          .sort((a, b) => a.dist - b.dist)
          .slice(0, limit);
        
        setArticles(sortedArticles);
        if (window.addArticleMarkers) {
          window.addArticleMarkers(sortedArticles);
        }
      }
    } catch (error) {
      console.error('Error fetching Wikipedia articles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add this helper function to calculate actual distances
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
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
      console.log('Fetching articles with new parameters:', {
        category: selectedCategory,
        radius,
        limit
      });
      fetchNearbyArticles(currentLocation.lat, currentLocation.lon);
    }
  }, [selectedCategory, currentLocation, radius, limit]);

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
      } else {
        // Show error message in search results with more helpful information
        setSearchResults([{
          title: page.title,
          description: "This article doesn't have location information. Try searching for a physical place, landmark, or building instead.",
          error: true,
          noLocation: true
        }]);
        
        // Keep the search term so user can try again
        setSearchTerm(title);
      }
    } catch (error) {
      console.error('Error fetching article location:', error);
      setSearchResults([{
        title: "Error",
        description: "Unable to find location information for this article. Try searching for a physical place or landmark.",
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed right-0 bottom-0 md:right-4 md:top-4 w-full md:w-96 bg-transparent backdrop-blur-sm supports-[backdrop-filter]:bg-background/20 max-h-[75vh] md:max-h-[90vh] overflow-hidden z-[1000] pb-safe transition-all duration-300 ease-in-out">
      <CardHeader className="flex flex-col border-b space-y-4 p-3 md:p-6 sticky top-0 bg-transparent backdrop-blur-sm supports-[backdrop-filter]:bg-background/30 z-[1005] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">WikiMaps 🌎</CardTitle>
            <p className="text-xs text-muted-foreground">Learning geographically</p>
          </div>
          <div className="flex gap-2">
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
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 md:hidden transition-transform duration-300 ease-in-out"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </div>
            </Button>
          </div>
        </div>

        <div className={`space-y-4 transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'opacity-100 max-h-[1000px]' 
            : 'opacity-0 max-h-0 md:opacity-100 md:max-h-[1000px]'
        }`}>
          <div className="grid grid-cols-1 gap-2">
            <div className="relative flex-1 z-[1002]">
              <label className="text-xs font-medium mb-1 block">
                Location Search
              </label>
              <div className="relative">
                <Input
                  placeholder="e.g., 'Cairo, Egypt' or 'Austin, Texas'"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchLocation(locationSearch);
                    }
                  }}
                  className="pr-16"
                />
                {locationSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-8 top-0 h-full"
                    onClick={() => setLocationSearch('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => searchLocation(locationSearch)}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative z-[1003]">
              <label className="text-xs font-medium mb-1 block">
                Article Search
              </label>
              <div className="relative">
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
                  className="pr-16"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-8 top-0 h-full"
                    onClick={() => {
                      setSearchTerm('');
                      setSearchResults([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => {
                    if (searchResults.length > 0) {
                      fetchArticleLocation(searchResults[0].title);
                      setSearchResults([]);
                      setSearchTerm('');
                    }
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {isSearching && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}
              
              {searchResults.length > 0 && searchTerm && (
                <Card className="absolute w-full mt-1 z-[1004] max-h-[300px] overflow-auto">
                  <CardContent className="p-2">
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          result.error 
                            ? result.noLocation
                              ? 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/10 dark:text-yellow-400'
                              : 'bg-red-50 text-red-900 dark:bg-red-900/10 dark:text-red-400'
                            : 'hover:bg-accent cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!result.error) {
                            fetchArticleLocation(result.title);
                            setSearchResults([]); // Clear search results
                            setSearchTerm(''); // Clear search input
                          }
                        }}
                      >
                        <h4 className="font-medium">{result.title}</h4>
                        {result.description && (
                          <p className={`text-sm ${
                            result.error 
                              ? result.noLocation
                                ? 'text-yellow-700 dark:text-yellow-400'
                                : 'text-red-700 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}>
                            {result.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-2">
              <label className="text-xs font-medium mb-1 block">
                Settings
              </label>
              <div className="flex gap-2">
                <Select 
                  value={selectedCategory} 
                  onValueChange={(value) => {
                    console.log('Category changed to:', value);
                    setSelectedCategory(value);
                    // Force a new API call with current location and new category
                    if (currentLocation) {
                      setLoading(true); // Show loading state
                      fetchNearbyArticles(currentLocation.lat, currentLocation.lon).then(() => {
                        console.log('Finished fetching articles for category:', value);
                      });
                    }
                  }} 
                  className="w-full"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by..." />
                  </SelectTrigger>
                  <SelectContent className="z-[1001]">
                    <SelectItem value="all">All Places</SelectItem>
                    <SelectItem value="landmarks">Landmarks</SelectItem>
                    <SelectItem value="culture">Culture</SelectItem>
                    <SelectItem value="history">History</SelectItem>
                    <SelectItem value="nature">Nature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-sm">Search Radius</label>
                  <span className="text-sm text-muted-foreground">
                    {radius < 1000 ? `${radius}m` : `${(radius/1000).toFixed(1)}km`}
                  </span>
                </div>
                <Slider
                  value={[radius]}
                  onValueChange={([value]) => {
                    setRadius(value);
                    if (currentLocation) {
                      fetchNearbyArticles(currentLocation.lat, currentLocation.lon);
                    }
                  }}
                  min={100}     // Minimum 100m for better usability
                  max={10000}   // Maximum 10km (Wikipedia API limit)
                  step={100}    // Increment by 100m
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-sm">Results Limit</label>
                  <span className="text-sm text-muted-foreground">{limit} articles</span>
                </div>
                <Slider
                  value={[limit]}
                  onValueChange={([value]) => {
                    setLimit(value);
                    if (currentLocation) {
                      setLoading(true);
                      fetchNearbyArticles(currentLocation.lat, currentLocation.lon);
                    }
                  }}
                  min={5}
                  max={50}
                  step={5}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className={`overflow-auto max-h-[calc(75vh-80px)] md:max-h-[calc(90vh-120px)] p-3 md:p-6 transition-all duration-300 ease-in-out ${
        isExpanded 
          ? 'opacity-100 max-h-[1000px]' 
          : 'opacity-0 max-h-0 md:opacity-100 md:max-h-[1000px]'
      }`}>
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
                className={`p-3 md:p-4 hover:bg-accent/80 bg-background/40 backdrop-blur-sm transition-colors cursor-pointer ${
                  highlightedArticle === article.pageid ? 'ring-2 ring-primary' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setHighlightedArticle(article.pageid);
                  if (window.setMapCenter) {
                    window.setMapCenter(article.lat, article.lon, 15);
                  }
                  if (window.highlightMarker) {
                    window.highlightMarker(article.pageid);
                  }
                }}
              >
                <div className="flex items-start gap-2 md:gap-4">
                  {article.thumbnail && (
                    <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24">
                      <img 
                        src={article.thumbnail} 
                        alt={article.title}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1 truncate">{article.title}</h3>
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
                <div className="mt-2 md:mt-3 flex justify-end">
                  <Button 
                    variant="link" 
                    className="text-sm p-0 h-auto"
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