import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverPopup } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({ value, onChange, placeholder = 'Сонгох' }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger render={
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, 'yyyy-MM-dd') : placeholder}
        </Button>
      } />
      <PopoverPortal>
        <PopoverPositioner align="start">
          <PopoverPopup className="w-auto p-0">
            <Calendar mode="single" selected={value} onSelect={onChange} />
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  )
}
