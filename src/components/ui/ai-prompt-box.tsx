'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, BrainCog, FolderCog, Globe, Mic, Paperclip, Square, StopCircle, X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

type PromptMode = 'search' | 'think' | 'canvas'

const modeConfig: Record<
  PromptMode,
  {
    label: string
    placeholder: string
    activeClassName: string
    inactiveClassName: string
    textClassName: string
    Icon: typeof Globe
  }
> = {
  search: {
    label: 'Search',
    placeholder: 'Search the web...',
    activeClassName: 'bg-[#1EAEDB]/15 border-[#1EAEDB] text-[#1EAEDB]',
    inactiveClassName: 'bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]',
    textClassName: 'text-[#1EAEDB]',
    Icon: Globe,
  },
  think: {
    label: 'Think',
    placeholder: 'Think deeply...',
    activeClassName: 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]',
    inactiveClassName: 'bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]',
    textClassName: 'text-[#8B5CF6]',
    Icon: BrainCog,
  },
  canvas: {
    label: 'Canvas',
    placeholder: 'Create on canvas...',
    activeClassName: 'bg-[#F97316]/15 border-[#F97316] text-[#F97316]',
    inactiveClassName: 'bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]',
    textClassName: 'text-[#F97316]',
    Icon: FolderCog,
  },
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={1}
    className={cn(
      'flex w-full resize-none rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
      'min-h-[44px] max-h-[240px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#444444] hover:scrollbar-thumb-[#555555]',
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
        'z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md',
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
        'border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 md:max-w-[800px]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 transition-all hover:bg-[#2E3033]">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
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
      default: 'bg-white text-black hover:bg-white/80',
      outline: 'border border-[#444444] bg-transparent hover:bg-[#3A3A40]',
      ghost: 'bg-transparent hover:bg-[#3A3A40]',
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

interface VoiceRecorderProps {
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: (duration: number) => void
  visualizerBars?: number
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = React.useRef(0)

  React.useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      if (elapsedRef.current > 0) {
        onStopRecording(elapsedRef.current)
      }

      elapsedRef.current = 0
      setTime(0)
      return
    }

    onStartRecording()
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setTime(elapsedRef.current)
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording, onStartRecording, onStopRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center py-3 transition-all duration-300',
        isRecording ? 'opacity-100' : 'h-0 opacity-0'
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm text-white/80">{formatTime(time)}</span>
      </div>
      <div className="flex h-10 w-full items-center justify-center gap-0.5 px-4">
        {Array.from({ length: visualizerBars }).map((_, index) => (
          <div
            key={index}
            className="w-0.5 rounded-full bg-white/50 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${index * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

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
          className="relative overflow-hidden rounded-2xl bg-[#1F2023] shadow-2xl"
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
              'ai-prompt-box rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300',
              isLoading && 'border-red-500/70',
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
    const [isRecording, setIsRecording] = React.useState(false)
    const [activeMode, setActiveMode] = React.useState<PromptMode | null>(null)
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

    const handleModeToggle = (mode: PromptMode) => {
      setActiveMode((currentMode) => (currentMode === mode ? null : mode))
    }

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

      const formattedInput = activeMode && input.trim() ? `[${modeConfig[activeMode].label}: ${input.trim()}]` : input.trim()

      onSend?.(formattedInput, files)
      setInput('')
      setFiles([])
      setFilePreview(null)
    }, [activeMode, files, input, onSend, setInput])

    const handlePrimaryAction = () => {
      if (isLoading) {
        onCancel?.()
        return
      }

      if (isRecording) {
        setIsRecording(false)
        return
      }

      if (input.trim() || files.length > 0) {
        handleSubmit()
        return
      }

      setIsRecording(true)
    }

    const handleStopRecording = React.useCallback(
      (duration: number) => {
        onSend?.(`[Voice message - ${duration} seconds]`, [])
      },
      [onSend]
    )

    const hasContent = input.trim() !== '' || files.length > 0
    const promptPlaceholder = activeMode ? modeConfig[activeMode].placeholder : placeholder
    const primaryTooltip = isLoading
      ? onCancel
        ? 'Stop generation'
        : 'Generating...'
      : isRecording
        ? 'Stop recording'
        : hasContent
          ? 'Send message'
          : 'Voice message'

    return (
      <>
        <PromptInput
          ref={ref}
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            'w-full border-[#444444] bg-[#1F2023] shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out',
            isRecording && 'border-red-500/70',
            className
          )}
          disabled={isLoading || isRecording}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && !isRecording && filePreview && (
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

          <div className={cn('transition-all duration-300', isRecording ? 'h-0 overflow-hidden opacity-0' : 'opacity-100')}>
            <PromptInputTextarea placeholder={promptPlaceholder} className="text-base" onPaste={handlePaste} />
          </div>

          {isRecording && (
            <VoiceRecorder
              isRecording={isRecording}
              onStartRecording={() => undefined}
              onStopRecording={handleStopRecording}
            />
          )}

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div
              className={cn(
                'flex items-center gap-1 transition-opacity duration-300',
                isRecording ? 'invisible h-0 opacity-0' : 'visible opacity-100'
              )}
            >
              <PromptInputAction tooltip="Upload image">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-gray-600/30 hover:text-[#D1D5DB]"
                  disabled={isRecording}
                >
                  <Paperclip className="h-5 w-5 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(event) => {
                      if (event.target.files && event.target.files.length > 0) {
                        processFile(event.target.files[0])
                      }

                      event.target.value = ''
                    }}
                  />
                </button>
              </PromptInputAction>

              <div className="flex items-center">
                {(Object.keys(modeConfig) as PromptMode[]).map((mode, index) => {
                  const config = modeConfig[mode]
                  const Icon = config.Icon
                  const isActive = activeMode === mode

                  return (
                    <React.Fragment key={mode}>
                      {index > 0 && <CustomDivider />}
                      <button
                        type="button"
                        onClick={() => handleModeToggle(mode)}
                        className={cn(
                          'flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all',
                          isActive ? config.activeClassName : config.inactiveClassName
                        )}
                      >
                        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                          <motion.div
                            animate={{ rotate: isActive ? 360 : 0, scale: isActive ? 1.1 : 1 }}
                            whileHover={{
                              rotate: isActive ? 360 : 15,
                              scale: 1.1,
                              transition: { type: 'spring', stiffness: 300, damping: 10 },
                            }}
                            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                          >
                            <Icon className={cn('h-4 w-4', isActive ? config.textClassName : 'text-inherit')} />
                          </motion.div>
                        </div>
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 'auto', opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className={cn('overflow-hidden whitespace-nowrap text-xs', config.textClassName)}
                            >
                              {config.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>
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
                    ? 'bg-white text-[#1F2023] hover:bg-white/80'
                    : isRecording
                      ? 'bg-transparent text-red-500 hover:bg-gray-600/30 hover:text-red-400'
                      : hasContent
                        ? 'bg-white text-[#1F2023] hover:bg-white/80'
                        : 'bg-transparent text-[#9CA3AF] hover:bg-gray-600/30 hover:text-[#D1D5DB]'
                )}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-[#1F2023] animate-pulse" />
                ) : isRecording ? (
                  <StopCircle className="h-5 w-5 text-red-500" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-[#1F2023]" />
                ) : (
                  <Mic className="h-5 w-5 text-current transition-colors" />
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
