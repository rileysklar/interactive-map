import React, { useState, useEffect } from 'react';

interface WikiArticle {
  pageid: number;
  title: string;
  extract?: string;
  dist: number;
  lat: number;
  lon: number;
}

export const WikipediaOverlay = () => {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNearbyArticles = async (lat, lon) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?` + 
        new URLSearchParams({
          action: 'query',
          list: 'geosearch',
          gscoord: `${lat}|${lon}`,
          gsradius: '10000',
          gslimit: '10',
          format: 'json',
          origin: '*'
        })
      );
      
      const data = await response.json();
      if (data.query && data.query.geosearch) {
        const articlesWithDetails = await Promise.all(
          data.query.geosearch.map(async (place) => {
            const detailsResponse = await fetch(
              `https://en.wikipedia.org/w/api.php?` +
              new URLSearchParams({
                action: 'query',
                pageids: place.pageid,
                prop: 'extracts',
                exintro: '1',
                format: 'json',
                origin: '*'
              })
            );
            const detailsData = await detailsResponse.json();
            const page = detailsData.query.pages[place.pageid];
            return {
              ...place,
              extract: page.extract
            };
          })
        );
        setArticles(articlesWithDetails);
      }
    } catch (error) {
      console.error('Error fetching Wikipedia articles:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        fetchNearbyArticles(position.coords.latitude, position.coords.longitude);
      });
    }
  }, []);

  return (
    <div className="absolute top-4 right-4 w-80 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Nearby Places</h2>
      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.pageid} className="border-b border-gray-200 last:border-0 pb-2">
              <h3 className="font-medium">{article.title}</h3>
              <p className="text-sm text-gray-600 mt-1" 
                 dangerouslySetInnerHTML={{ __html: article.extract?.substring(0, 150) + '...' }} />
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(article.dist)}m away
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}; 