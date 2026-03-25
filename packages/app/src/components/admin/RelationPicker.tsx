"use client";

import { useState, useRef, useEffect } from "react";

export interface RelationOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface RelationPickerBaseProps {
  label: string;
  options: RelationOption[];
  onSearch?: (query: string) => void;
  onCreateNew?: (name: string) => void;
  placeholder?: string;
  loading?: boolean;
}

interface SinglePickerProps extends RelationPickerBaseProps {
  multi?: false;
  value: string | null;
  onChange: (id: string | null) => void;
}

interface MultiPickerProps extends RelationPickerBaseProps {
  multi: true;
  value: string[];
  onChange: (ids: string[]) => void;
}

type RelationPickerProps = SinglePickerProps | MultiPickerProps;

export function RelationPicker(props: RelationPickerProps) {
  const { label, options, onSearch, onCreateNew, placeholder = "Search...", loading } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    onSearchRef.current?.(search);
  }, [search]);

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  function isSelected(id: string): boolean {
    if (props.multi) return props.value.includes(id);
    return props.value === id;
  }

  function handleSelect(id: string) {
    if (props.multi) {
      if (props.value.includes(id)) {
        props.onChange(props.value.filter((v) => v !== id));
      } else {
        props.onChange([...props.value, id]);
      }
    } else {
      props.onChange(id);
      setOpen(false);
      setSearch("");
    }
  }

  function handleRemove(id: string) {
    if (props.multi) {
      props.onChange(props.value.filter((v) => v !== id));
    } else {
      props.onChange(null);
    }
  }

  const selectedOptions = options.filter((o) => isSelected(o.id));
  const hasValue = props.multi ? props.value.length > 0 : props.value !== null;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-curtn-muted mb-1">{label}</label>

      {/* Value display / trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[38px] rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-left text-sm text-curtn-cream hover:border-curtn-coral/50 focus:border-curtn-coral focus:outline-none transition-colors cursor-pointer flex flex-wrap items-center gap-1.5"
      >
        {hasValue ? (
          selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded-md bg-curtn-dark px-2 py-0.5 text-xs text-curtn-cream"
            >
              {opt.label}
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(opt.id);
                }}
                className="text-curtn-muted hover:text-curtn-cream ml-0.5 cursor-pointer"
              >
                x
              </span>
            </span>
          ))
        ) : (
          <span className="text-curtn-muted text-xs">None</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-curtn-dark bg-curtn-surface shadow-lg overflow-hidden">
          <div className="p-2 border-b border-curtn-dark">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-2.5 py-1.5 text-xs text-curtn-cream placeholder:text-curtn-muted focus:border-curtn-coral focus:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading && (
              <p className="px-3 py-2 text-xs text-curtn-muted">Loading...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-curtn-muted">No results</p>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                  isSelected(opt.id)
                    ? "bg-curtn-coral/10 text-curtn-coral"
                    : "text-curtn-cream hover:bg-curtn-dark/40"
                }`}
              >
                <span>
                  {opt.label}
                  {opt.sublabel && (
                    <span className="text-curtn-muted ml-1.5">{opt.sublabel}</span>
                  )}
                </span>
                {isSelected(opt.id) && <span className="text-curtn-coral">&#10003;</span>}
              </button>
            ))}
            {onCreateNew && search.trim() && (
              <button
                type="button"
                onClick={() => {
                  onCreateNew(search.trim());
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-curtn-coral hover:bg-curtn-coral/10 transition-colors cursor-pointer border-t border-curtn-dark"
              >
                + Add &ldquo;{search.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
