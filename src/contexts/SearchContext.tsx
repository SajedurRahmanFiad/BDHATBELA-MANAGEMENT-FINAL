import React, { createContext, useContext, useState } from 'react';

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // keep clearSearch stable so consumers don't re-run effects when it changes
  const clearSearch = React.useCallback(() => setSearchQuery(''), []);

  const value = React.useMemo(
    () => ({ searchQuery, setSearchQuery, clearSearch }),
    [searchQuery, setSearchQuery, clearSearch]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    // In development it's helpful to know if something is rendered outside the
    // provider. Instead of crashing the whole app, warn and return a no-op
    // implementation so consumer components continue to work gracefully. This
    // guards against transient issues (e.g. during HMR or early renders).
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useSearch called outside SearchProvider');
    }
    return {
      searchQuery: '',
      setSearchQuery: () => {},
      clearSearch: () => {}
    };
  }
  return context;
};
