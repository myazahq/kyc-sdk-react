'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * shadcn-style calendar over react-day-picker, fully styled via classNames
 * (no external stylesheet). Month/year dropdowns make far-back dates (DOB)
 * reachable without endless clicking.
 */
function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      captionLayout="dropdown"
      startMonth={new Date(1900, 0)}
      endMonth={new Date(new Date().getFullYear() + 10, 11)}
      className={cn('select-none', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'space-y-3',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'hidden',
        dropdowns: 'flex items-center gap-1.5',
        dropdown_root: 'relative',
        dropdown:
          'h-8 appearance-none rounded-lg border border-input bg-background px-2 pr-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring',
        nav: 'absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between',
        button_previous:
          'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
        button_next:
          'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-[11px] font-medium text-muted-foreground',
        week: 'mt-1 flex',
        day: 'p-0',
        day_button:
          'flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        today: '[&>button]:font-semibold [&>button]:text-primary',
        outside: '[&>button]:text-muted-foreground/50',
        disabled: '[&>button]:pointer-events-none [&>button]:opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}

export { Calendar };
