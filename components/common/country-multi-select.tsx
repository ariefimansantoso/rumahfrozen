"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COUNTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type CommonProps = {
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerClassName?: string;
};

type CountrySelectSingleProps = CommonProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type CountrySelectMultiProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type CountrySelectProps =
  | CountrySelectSingleProps
  | CountrySelectMultiProps;

const normalizeCountry = (value: string) => value.trim().toLowerCase();

export function CountrySelect(props: CountrySelectProps) {
  const {
    id,
    placeholder = "Select country",
    searchPlaceholder = "Search countries...",
    emptyText = "No countries found.",
    triggerClassName,
  } = props;
  const isMulti = props.multiple === true;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedCountries = useMemo(() => {
    if (isMulti) {
      const value = props.value;
      return Array.isArray(value) ? value.filter(Boolean) : [];
    }
    const value = props.value;
    return value ? [value] : [];
  }, [isMulti, props.value]);

  const selectedSet = useMemo(
    () => new Set(selectedCountries.map(normalizeCountry)),
    [selectedCountries],
  );

  const filteredCountries = useMemo(() => {
    const q = normalizeCountry(query);
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((country) => normalizeCountry(country).includes(q));
  }, [query]);

  const handleSelect = (country: string) => {
    if (!isMulti) {
      props.onChange(country);
      setOpen(false);
      setQuery("");
      return;
    }

    const target = normalizeCountry(country);
    const isAlreadySelected = selectedSet.has(target);
    if (isAlreadySelected) {
      props.onChange(
        selectedCountries.filter(
          (item) => normalizeCountry(item) !== target,
        ),
      );
      return;
    }
    props.onChange([...selectedCountries, country]);
  };

  const removeCountry = (country: string) => {
    if (!isMulti) {
      props.onChange("");
      return;
    }
    const target = normalizeCountry(country);
    props.onChange(
      selectedCountries.filter((item) => normalizeCountry(item) !== target),
    );
  };

  const selectedLabel = isMulti
    ? selectedCountries.length === 0
      ? placeholder
      : selectedCountries.length === 1
        ? selectedCountries[0]
        : `${selectedCountries.length} countries selected`
    : selectedCountries[0] || placeholder;

  const isPlaceholder = isMulti
    ? selectedCountries.length === 0
    : !props.value;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              isPlaceholder && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="min-w-0 truncate text-left">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ScrollArea className="h-72">
            <div className="p-1">
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = selectedSet.has(normalizeCountry(country));

                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => handleSelect(country)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                        isSelected && "bg-accent",
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{country}</span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {isMulti && selectedCountries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedCountries.map((country) => (
            <Badge
              key={country}
              variant="secondary"
              className="max-w-full gap-1 pr-1"
            >
              <span className="truncate">{country}</span>
              <button
                type="button"
                onClick={() => removeCountry(country)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Remove ${country}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Backwards-compatible export for existing usages.
export function CountryMultiSelect(
  props: CountrySelectMultiProps | (CommonProps & {
    value: string[];
    onChange: (value: string[]) => void;
  }),
) {
  return <CountrySelect {...props} multiple />;
}
