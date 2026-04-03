import React from 'react';
import { useSearch } from '../contexts/SearchContext';

export function useUrlSyncedSearchQuery(urlSearchQuery: string) {
  const { searchQuery, setSearchQuery } = useSearch();
  const [lastHydratedUrlSearchQuery, setLastHydratedUrlSearchQuery] = React.useState<string | null>(null);

  const isHydratingFromUrl = lastHydratedUrlSearchQuery !== urlSearchQuery;

  React.useEffect(() => {
    if (!isHydratingFromUrl) return;

    if (searchQuery !== urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    }

    setLastHydratedUrlSearchQuery(urlSearchQuery);
  }, [isHydratingFromUrl, searchQuery, setSearchQuery, urlSearchQuery]);

  return {
    searchQuery: isHydratingFromUrl ? urlSearchQuery : searchQuery,
    setSearchQuery,
    isHydratingFromUrl,
  };
}
