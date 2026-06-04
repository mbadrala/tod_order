import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmDialog({ open, onOpenChange, title, message, confirmLabel = 'Устгах', onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogPopup>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2">{message}</AlertDialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogClose render={<Button variant="outline">Цуцлах</Button>} />
            <Button onClick={() => { onConfirm(); /* close handled by parent via onOpenChange */ }}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
