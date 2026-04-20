'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import { ArrowUp, Paperclip, Square, X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'


interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={1}
    className={cn(
      'flex w-full resize-none rounded-md border-none bg-transparent px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
      'min-h-[44px] max-h-[240px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border-strong hover:scrollbar-thumb-border',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary shadow-md',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

const Dialog = DialogPrimitive.Root
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-[90vw] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl',
        'border border-border bg-surface p-0 shadow-xl duration-300 md:max-w-[800px]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-surface-inset p-2 transition-all hover:bg-surface-hover">
        <X className="h-5 w-5 text-text-secondary hover:text-text-primary" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-gray-100', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-accent text-white hover:bg-accent-hover',
      outline: 'border border-border bg-transparent hover:bg-surface-hover',
      ghost: 'bg-transparent hover:bg-surface-hover',
    }

    const sizeClasses = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 px-3 text-sm',
      lg: 'h-12 px-6',
      icon: 'h-8 w-8 rounded-full',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

interface ImageViewDialogProps {
  imageUrl: string | null
  onClose: () => void
}

const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null

  return (
    <Dialog open={Boolean(imageUrl)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] border-none bg-transparent p-0 shadow-none md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl bg-surface shadow-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Full preview" className="max-h-[80vh] w-full rounded-2xl object-contain" />
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

interface PromptInputContextType {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
}

const PromptInputContext = React.createContext<PromptInputContextType | null>(null)

function usePromptInput() {
  const context = React.useContext(PromptInputContext)

  if (!context) {
    throw new Error('usePromptInput must be used within a PromptInput')
  }

  return context
}

interface PromptInputProps {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
}

const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value ?? '')
    const currentValue = value ?? internalValue

    const handleChange = (nextValue: string) => {
      setInternalValue(nextValue)
      onValueChange?.(nextValue)
    }

    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: currentValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              'ai-prompt-box rounded-3xl border border-border bg-surface p-2 shadow-md transition-all duration-300',
              isLoading && 'border-accent/70',
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    )
  }
)
PromptInput.displayName = 'PromptInput'

interface PromptInputTextareaProps extends React.ComponentProps<typeof Textarea> {
  disableAutosize?: boolean
  placeholder?: string
}

const PromptInputTextarea: React.FC<PromptInputTextareaProps> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) {
      return
    }

    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height =
      typeof maxHeight === 'number'
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`
  }, [disableAutosize, maxHeight, value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit?.()
    }

    onKeyDown?.(event)
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      className={cn('text-base', className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  )
}

const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn('flex items-center gap-2', className)} {...props}>
    {children}
  </div>
)

interface PromptInputActionProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> {
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  tooltipClassName?: string
}

const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  side = 'top',
  tooltipClassName,
  ...props
}) => {
  const { disabled } = usePromptInput()

  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={tooltipClassName}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

const CustomDivider: React.FC = () => (
  <div className="relative mx-1 h-6 w-[1.5px]">
    <div
      className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent"
      style={{
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)',
      }}
    />
  </div>
)

interface PromptInputBoxProps {
  value?: string
  onValueChange?: (value: string) => void
  onSend?: (message: string, files?: File[]) => void
  onCancel?: () => void
  isLoading?: boolean
  placeholder?: string
  className?: string
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ value, onValueChange, onSend, onCancel, isLoading = false, placeholder = 'Type your message here...', className }, ref) => {
    const [internalInput, setInternalInput] = React.useState(value ?? '')
    const [files, setFiles] = React.useState<File[]>([])
    const [filePreview, setFilePreview] = React.useState<string | null>(null)
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null)
    const uploadInputRef = React.useRef<HTMLInputElement>(null)
    const isControlled = value !== undefined
    const input = isControlled ? value : internalInput

    const setInput = React.useCallback(
      (nextValue: string) => {
        if (!isControlled) {
          setInternalInput(nextValue)
        }

        onValueChange?.(nextValue)
      },
      [isControlled, onValueChange]
    )

    const processFile = React.useCallback((file: File) => {
      if (!file.type.startsWith('image/')) {
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        return
      }

      setFiles([file])

      const reader = new FileReader()
      reader.onload = (event) => setFilePreview((event.target?.result as string | null) ?? null)
      reader.readAsDataURL(file)
    }, [])

    const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
    }, [])

    const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
    }, [])

    const handleDrop = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()

        const droppedFiles = Array.from(event.dataTransfer.files)
        const imageFile = droppedFiles.find((file) => file.type.startsWith('image/'))

        if (imageFile) {
          processFile(imageFile)
        }
      },
      [processFile]
    )

    const handleRemoveFile = () => {
      setFiles([])
      setFilePreview(null)
    }

    const handlePaste = React.useCallback(
      (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = event.clipboardData?.items

        if (!clipboardItems) {
          return
        }

        for (let index = 0; index < clipboardItems.length; index += 1) {
          if (!clipboardItems[index].type.includes('image')) {
            continue
          }

          const file = clipboardItems[index].getAsFile()

          if (!file) {
            continue
          }

          event.preventDefault()
          processFile(file)
          break
        }
      },
      [processFile]
    )

    const handleSubmit = React.useCallback(() => {
      if (!input.trim() && files.length === 0) {
        return
      }

      const formattedInput = input.trim()

      onSend?.(formattedInput, files)
      setInput('')
      setFiles([])
      setFilePreview(null)
    }, [files, input, onSend, setInput])

    const handlePrimaryAction = () => {
      if (isLoading) {
        onCancel?.()
        return
      }

      if (input.trim() || files.length > 0) {
        handleSubmit()
      }
    }

    const hasContent = input.trim() !== '' || files.length > 0
    const promptPlaceholder = placeholder
    const primaryTooltip = isLoading
      ? onCancel
        ? 'Stop generation'
        : 'Generating...'
      : hasContent
        ? 'Verstuur bericht'
        : 'Typ een bericht'

    return (
      <>
        <PromptInput
          ref={ref}
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            'w-full border-border bg-surface shadow-md transition-all duration-300 ease-in-out',
            className
          )}
          disabled={isLoading}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && filePreview && (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              <div className="group relative">
                <div
                  className="h-16 w-16 cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
                  onClick={() => setSelectedImage(filePreview)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={filePreview} alt={files[0]?.name ?? 'Preview'} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleRemoveFile()
                    }}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <PromptInputTextarea placeholder={promptPlaceholder} className="text-base" onPaste={handlePaste} />

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div className="flex items-center gap-1">
              <PromptInputAction tooltip="Foto uploaden (bijv. bonnetje)">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-inset hover:text-text-secondary">
                  <Paperclip className="h-5 w-5 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      if (event.target.files && event.target.files.length > 0) {
                        processFile(event.target.files[0])
                      }

                      event.target.value = ''
                    }}
                  />
                </button>
              </PromptInputAction>
            </div>

            <PromptInputAction tooltip={primaryTooltip}>
              <Button
                variant="default"
                size="icon"
                type="button"
                onClick={handlePrimaryAction}
                disabled={isLoading && !onCancel}
                className={cn(
                  'h-8 w-8 rounded-full transition-all duration-200',
                  isLoading
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : hasContent
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'bg-surface-inset text-text-tertiary hover:bg-surface-hover hover:text-text-secondary'
                )}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-white animate-pulse" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-white" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-text-tertiary" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    )
  }
)
PromptInputBox.displayName = 'PromptInputBox'
