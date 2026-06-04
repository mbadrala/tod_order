import { DayPicker, UI, DayFlag, SelectionState } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        [UI.Root]: 'w-fit',
        [UI.Months]: 'flex flex-col sm:flex-row gap-4',
        [UI.Month]: 'flex flex-col',
        [UI.MonthCaption]: 'flex items-center justify-center py-1 relative',
        [UI.CaptionLabel]: 'text-sm font-medium',
        [UI.Nav]: 'flex items-center gap-1',
        [UI.PreviousMonthButton]: cn(
          'inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground',
          'hover:bg-accent hover:text-accent-foreground absolute left-1 top-1',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&>svg]:size-4'
        ),
        [UI.NextMonthButton]: cn(
          'inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground',
          'hover:bg-accent hover:text-accent-foreground absolute right-1 top-1',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&>svg]:size-4'
        ),
        [UI.MonthGrid]: 'w-full border-collapse mt-2',
        [UI.Weekdays]: 'flex',
        [UI.Weekday]: 'w-9 rounded-md text-xs text-muted-foreground font-normal',
        [UI.Weeks]: 'flex flex-col gap-0.5',
        [UI.Week]: 'flex',
        [UI.Day]: cn(
          'h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center',
          '[&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
          '[&:has([aria-selected].range_end)]:rounded-r-md [&:has([aria-selected].range_start)]:rounded-l-md',
          '[&:has([aria-selected].day_range_end)]:rounded-r-md [&:has([aria-selected].day_range_start)]:rounded-l-md'
        ),
        [UI.DayButton]: cn(
          'inline-flex items-center justify-center rounded-md h-9 w-9 p-0 font-normal',
          'hover:bg-accent hover:text-accent-foreground',
          'aria-selected:bg-primary aria-selected:text-primary-foreground',
          'aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
        ),
        [UI.Chevron]: 'size-4',
        ...classNames,
      }}
      modifiersClassNames={{
        [DayFlag.today]: 'bg-accent text-accent-foreground',
        [DayFlag.outside]: 'text-muted-foreground opacity-50',
        [DayFlag.disabled]: 'text-muted-foreground opacity-50',
        [SelectionState.selected]: '',
        ...(props.modifiersClassNames as Record<string, string>),
      }}
      {...props}
    />
  )
}

export { Calendar }
