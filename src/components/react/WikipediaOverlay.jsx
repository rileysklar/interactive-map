import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "../ui/select";
import { Slider } from "../ui/slider";
import { Search } from 'lucide-react';

export const WikipediaOverlay = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [highlightedArticle, setHighlightedArticle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('name');
  const [categories, setCategories] = useState(new Set());
  const [locationSearch, setLocationSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);

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
      console.log('Fetching articles for:', lat, lon, 'with limit:', limit); // Debug log

      // Initial API call to get nearby articles using current limit
      const geoUrl = `https://en.wikipedia.org/w/api.php?` + 
        new URLSearchParams({
          action: 'query',
          list: 'geosearch',
          gscoord: `${lat}|${lon}`,
          gsradius: '10000', // 10km radius
          gslimit: limit.toString(), // Use the current limit value
          format: 'json',
          origin: '*'
        });

      const response = await fetch(geoUrl);
      const data = await response.json();
      console.log('Wikipedia API response:', data); // Debug log

      if (data.query && data.query.geosearch) {
        const articlesWithDetails = await Promise.all(
          data.query.geosearch.map(async (place) => {
            const detailsUrl = `https://en.wikipedia.org/w/api.php?` +
              new URLSearchParams({
                action: 'query',
                pageids: place.pageid,
                prop: 'extracts|categories',
                exintro: '1',
                explaintext: '1',
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
              direction: getDirection(lat, lon, place.lat, place.lon)
            };
          })
        );

        console.log('Processed articles:', articlesWithDetails.length); // Debug log
        setArticles(articlesWithDetails);
        
        // Update map markers
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

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'relevance':
          if (searchTerm) {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            return (aTitle.includes(searchLower) && !bTitle.includes(searchLower)) ? -1 : 1;
          }
          return 0;
        default:
          return 0;
      }
    });
  }, [articles, searchTerm, sortBy]);

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

  const requestLocation = () => {
    setLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setCurrentLocation(newLocation);
          fetchNearbyArticles(newLocation.lat, newLocation.lon);
          if (window.setMapCenter) {
            window.setMapCenter(newLocation.lat, newLocation.lon);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setLoading(false);
        }
      );
    }
  };

  return (
    <Card className="fixed right-4 top-4 w-96 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 max-h-[90vh] overflow-hidden z-[1000]">
      <CardHeader className="border-b space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>Nearby Places</CardTitle>
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
            <Input
              placeholder="Search location..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchLocation(locationSearch);
                }
              }}
              className="pr-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => searchLocation(locationSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={requestLocation}
            title="Use my location"
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
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
            </svg>
          </Button>
        </div>

        <Input
          placeholder="Search articles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />

        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="relevance">Relevance</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
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
                setLoading(true); // Show loading state while fetching new results
              }}
              min={10}
              max={50}
              step={5}
              disabled={loading} // Disable slider while loading
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-auto max-h-[calc(90vh-120px)]">
        {!currentLocation ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <p className="mb-4">Search for a location or use your current location to see nearby Wikipedia articles</p>
            <Button onClick={requestLocation}>
              Use My Location
            </Button>
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
                <div className="flex items-start justify-between">
                  <div>
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
                    onClick={() => window.open(`https://en.wikipedia.org/?curid=${article.pageid}`, '_blank')}
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