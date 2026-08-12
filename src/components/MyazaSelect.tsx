'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { useDropdownAnchor } from '../lib/use-dropdown-anchor';

// A plain single-choice select — the web counterpart of the RN and Flutter
// SDKs' MyazaSelect, so a field rendered as a dropdown on a phone is a dropdown
// here too rather than a column of tappable cards.
//
// Deliberately NOT shadcn's Radix Select: it portals to document.body, and
// Radix Dialog sets `pointer-events: none` there while the modal is open, so
// the list becomes unclickable and taps fall through to whatever sits behind
// it. This anchors into the dialog root instead. See lib/use-dropdown-anchor.

export interface MyazaSelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading visual (e.g. a currency's flag). */
  icon?: React.ReactNode;
}

export interface MyazaSelectProps<T extends string> {
  id?: string;
  value: T | undefined;
  options: MyazaSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** False renders it inert — e.g. locked once a document is attached. */
  enabled?: boolean;
  'aria-label'?: string;
}

export function MyazaSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  enabled = true,
  'aria-label': ariaLabel,
}: MyazaSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchor = useDropdownAnchor(open, triggerRef, { width: 'trigger', menuRef });

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The menu is portaled out of rootRef, so it needs its own test.
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={!enabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center gap-2.5 rounded-xl border border-input bg-background px-3 text-left text-sm transition-colors',
          'hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground',
        )}
      >
        {selected?.icon}
        <span className="flex-1 truncate">{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>

      {open && anchor.host && createPortal(
        <div
          ref={menuRef}
          style={anchor.style}
          role="listbox"
          className="z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-slide-up"
        >
          <div className="overflow-y-auto p-1.5" style={{ maxHeight: anchor.maxHeight }}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  o.value === value && 'bg-primary/5 font-medium',
                )}
              >
                {o.icon}
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
              </button>
            ))}
          </div>
        </div>,
        anchor.host,
      )}
    </div>
  );
}
