"use client";

import { useState, useEffect } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Send } from "lucide-react";

function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export interface Action {
  id: string;
  label: string;
  icon: ReactNode;
  description?: string;
  short?: string;
  end?: string;
}

interface SearchResult {
  actions: Action[];
}

const defaultActions: Action[] = [];

function ActionSearchBar({
  actions = defaultActions,
  onActionSelect,
  label = "Zoek acties",
  placeholder = "Zoek actie of item...",
}: {
  actions?: Action[];
  onActionSelect?: (action: Action) => void;
  label?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (!isFocused) {
      setResult(null);
      return;
    }

    if (!debouncedQuery) {
      setResult({ actions });
      return;
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim();
    const filteredActions = actions.filter((action) => {
      const searchableText = [
        action.label,
        action.description,
        action.short,
        action.end,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });

    setResult({ actions: filteredActions });
  }, [actions, debouncedQuery, isFocused]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSelect = (action: Action) => {
    onActionSelect?.(action);
    setQuery("");
    setIsFocused(false);
  };

  return (
    <div className="w-full">
      <div className="relative">
        <label
          className="mb-1 hidden text-[11px] font-medium text-on-surface-variant lg:block"
          htmlFor="header-search"
        >
          {label}
        </label>
        <div className="relative">
          <Input
            id="header-search"
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            className="h-10 rounded-xl border-outline-variant bg-white pl-3 pr-9 text-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
            <AnimatePresence mode="popLayout">
              {query.length > 0 ? (
                <motion.div
                  key="send"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Send className="h-4 w-4 text-on-surface-variant" />
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Search className="h-4 w-4 text-on-surface-variant" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {isFocused && result && (
            <motion.div
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-[0_20px_60px_-32px_rgba(31,37,35,0.28)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              {result.actions.length === 0 ? (
                <div className="px-4 py-4 text-sm text-on-surface-variant">
                  Geen resultaten
                </div>
              ) : (
                <ul className="max-h-[320px] overflow-y-auto p-2">
                  {result.actions.map((action) => (
                    <li key={action.id}>
                      <button
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelect(action)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="text-on-surface-variant">{action.icon}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-on-surface">
                              {action.label}
                            </p>
                            {action.description && (
                              <p className="truncate text-xs text-on-surface-variant">
                                {action.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-on-surface-variant">
                          {action.short && <span>{action.short}</span>}
                          {action.end && <span>{action.end}</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-outline-variant px-4 py-2 text-xs text-on-surface-variant">
                Enter werkt via klik. Esc sluit door focus te verlaten.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export { ActionSearchBar };
