import { useState, useRef } from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverPortal, PopoverPositioner, PopoverPopup } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { Client } from '@/lib/api'

interface ClientSelectProps {
  clients: Client[]
  selectedCode: string
  selectedName: string
  selectedPhone: string
  onSelect: (client: { client_code: string; client_name: string; client_phone: string }) => void
  placeholder?: string
  valueKey?: 'code' | 'name' | 'both'
  disabled?: boolean
}

export function ClientSelect({ clients, selectedCode, selectedName, selectedPhone, onSelect, placeholder = 'Харилцагч хайх...', valueKey = 'both', disabled }: ClientSelectProps) {
  const [open, setOpen] = useState(false)
  const dismissedRef = useRef(false)

  const displayName = selectedName || selectedCode || placeholder
  const hasValue = !!(selectedCode || selectedName)

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      dismissedRef.current = true
      setTimeout(() => { dismissedRef.current = false }, 300)
    }
    setOpen(v)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger disabled={disabled} render={
        <Button variant="outline" role="combobox" aria-expanded={open} onFocus={() => { if (dismissedRef.current) return; if (!hasValue) setOpen(true) }}
          className={cn('w-full justify-between font-normal', !selectedName && !selectedCode && 'text-muted-foreground')}>
          {displayName}
          {selectedPhone && <span className="ml-2 text-xs text-muted-foreground">{selectedPhone}</span>}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      } />
      <PopoverPortal>
          <PopoverPositioner align="start" className="min-w-60">
          <PopoverPopup className="p-0">
            <Command>
              <CommandInput placeholder={placeholder} />
              <CommandList>
                <CommandEmpty>Харилцагч олдсонгүй</CommandEmpty>
                <CommandGroup>
                  {clients.map((c) => {
                    const cmdValue = valueKey === 'code' ? (c.client_code || '')
                      : valueKey === 'name' ? c.name
                      : `${c.client_code || ''} ${c.name}`
                    return (
                      <CommandItem
                        key={c.id}
                        value={cmdValue}
                        onSelect={() => {
                          dismissedRef.current = false
                          onSelect({
                            client_code: c.client_code || '',
                            client_name: c.name,
                            client_phone: c.phone || '',
                          })
                          setOpen(false)
                        }}
                      >
                        <CheckIcon
                          className={cn(
                            'mr-2 size-4',
                            (c.client_code === selectedCode || c.name === selectedName) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          {c.client_code && <span className="text-xs text-muted-foreground">{c.client_code}</span>}
                        </div>
                        {c.phone && <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  )
}
