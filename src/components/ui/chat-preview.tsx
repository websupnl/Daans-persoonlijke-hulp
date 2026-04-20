"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Sparkles, Bot, MessageSquare, Clock, Zap, Brain } from "lucide-react";

interface Message {
  avatar?: string;
  avatarBackground?: string;
  username: string;
  content: string;
  color?: string;
  duration: number;
  timestamp?: number;
  icon?: "sparkles" | "bot" | "message" | "clock" | "zap" | "brain";
}

interface Channel {
  name: string;
  description: string;
}

type Variations = "default" | "compact" | "expanded";

interface ChatPreviewProps {
  messages?: Message[];
  channel?: Channel;
  maxMessages?: number;
  className?: string;
  gradientBackground?: boolean;
  variation?: Variations;
  removeShadow?: boolean;
  theme?: {
    background?: string;
    border?: string;
    textColor?: string;
    avatarSize?: string;
  };
  autoPlay?: boolean;
  interval?: number;
}

const defaultTheme = {
  background: "bg-surface/80",
  border: "border border-border",
  textColor: "text-text-primary",
  avatarSize: "w-7 h-7 sm:w-8 sm:h-8",
};

// AI Assistant messages for Worklogs context
const defaultAiMessages: Message[] = [
  {
    avatarBackground: "bg-violet-500/30",
    username: "AI Assistent",
    content: "Goedemorgen! Klaar om je werk te loggen vandaag? 🚀",
    color: "text-violet-400",
    duration: 5000,
    icon: "sparkles",
  },
  {
    avatarBackground: "bg-emerald-500/30",
    username: "AI Assistent",
    content: "💡 Tip: Gebruik de timer voor precieze tijdregistratie",
    color: "text-emerald-400",
    duration: 6000,
    icon: "clock",
  },
  {
    avatarBackground: "bg-amber-500/30",
    username: "AI Assistent",
    content: "⚡ Probeer eens: \"2 uur aan Prime Animals\" - dan parse ik het automatisch!",
    color: "text-amber-400",
    duration: 7000,
    icon: "zap",
  },
  {
    avatarBackground: "bg-blue-500/30",
    username: "AI Assistent",
    content: "🎯 Focus tip: Werk in blokken van 90 minuten met 15 min pauze",
    color: "text-blue-400",
    duration: 6000,
    icon: "brain",
  },
  {
    avatarBackground: "bg-pink-500/30",
    username: "AI Assistent",
    content: "🤖 Grapje: Waarom ging de developer naar de dokter? Vanwege de bugs!",
    color: "text-pink-400",
    duration: 5000,
    icon: "bot",
  },
  {
    avatarBackground: "bg-cyan-500/30",
    username: "AI Assistent",
    content: "📊 Je hebt deze week al veel gedaan! Ga zo door!",
    color: "text-cyan-400",
    duration: 6000,
    icon: "message",
  },
  {
    avatarBackground: "bg-violet-500/30",
    username: "AI Assistent",
    content: "🎉 Weekend bijna in zicht! Nog even doorzetten...",
    color: "text-violet-400",
    duration: 5000,
    icon: "sparkles",
  },
];

const defaultChannel: Channel = {
  name: "ai-assistant",
  description: "Jouw persoonlijke AI werkassistent",
};

const iconMap = {
  sparkles: Sparkles,
  bot: Bot,
  message: MessageSquare,
  clock: Clock,
  zap: Zap,
  brain: Brain,
};

export function ChatPreview({
  messages = defaultAiMessages,
  channel = defaultChannel,
  maxMessages = 2,
  className,
  gradientBackground = true,
  variation = "default",
  removeShadow = false,
  theme = defaultTheme,
  autoPlay = true,
  interval,
}: ChatPreviewProps) {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && autoPlay) {
          // Start showing messages
          showNextMessage();
        } else {
          // Pause when not visible
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [autoPlay, messages]);

  const showNextMessage = () => {
    if (!isVisibleRef.current) return;

    const message = messages[currentIndex];
    const newMessage = {
      ...message,
      timestamp: Date.now(),
    };

    setVisibleMessages((prev) => [...prev, newMessage].slice(-maxMessages));
    setCurrentIndex((prev) => (prev + 1) % messages.length);

    // Schedule next message
    const delay = interval || message.duration || 5000;
    timeoutRef.current = setTimeout(showNextMessage, delay);
  };

  // Manual navigation
  const goToMessage = (index: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentIndex(index % messages.length);
    setVisibleMessages([]);
    showNextMessage();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        variation === "compact" && "max-w-[350px]",
        variation === "expanded" && "max-w-[700px]",
        variation === "default" && "max-w-[500px]",
        className
      )}
    >
      {gradientBackground && (
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-amber-500/10 rounded-2xl blur-xl opacity-50" />
      )}

      <div
        className={cn(
          "relative rounded-xl overflow-hidden backdrop-blur-sm",
          !removeShadow && "shadow-lg",
          theme.border,
          theme.background
        )}
      >
        <div className="border-b border-border/50 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
            <span className="font-medium text-[12px] sm:text-[13px]">
              #{channel.name}
            </span>
            <span className="text-text-tertiary">|</span>
            <span className="text-text-tertiary truncate flex-1 text-[11px] sm:text-[13px]">
              {channel.description}
            </span>
          </div>
        </div>

        <div className="p-2.5 sm:p-4 flex flex-col justify-end relative min-h-[100px] sm:min-h-[120px]">
          <div className="flex flex-col justify-end gap-2 sm:gap-3">
            {visibleMessages.length === 0 ? (
              <div className="text-center text-text-tertiary text-sm py-4">
                <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-50" />
                <span className="text-xs">AI Assistant komt zo bij je terug...</span>
              </div>
            ) : (
              visibleMessages.map((message, index) => {
                const IconComponent = message.icon ? iconMap[message.icon] : Bot;
                const isLatest = index === visibleMessages.length - 1;
                
                return (
                  <div
                    key={message.timestamp}
                    className={cn(
                      "flex items-start gap-2 sm:gap-3",
                      isLatest && "animate-message-appear"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-full flex-shrink-0 flex items-center justify-center",
                        theme.avatarSize,
                        message.avatarBackground ?? "bg-surface-inset"
                      )}
                    >
                      {message.avatar ? (
                        <Image
                          src={message.avatar}
                          alt={`${message.username}'s avatar`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <IconComponent className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", message.color ?? "text-text-secondary")} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium text-[12px] sm:text-[13px]",
                            message.color ?? "text-text-primary"
                          )}
                        >
                          {message.username}
                        </span>
                        <span className="text-text-tertiary shrink-0 text-[10px] sm:text-xs">
                          net
                        </span>
                      </div>
                      <p className={cn(theme.textColor, "text-[12px] sm:text-[13px] leading-relaxed")}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Quick navigation dots */}
          {messages.length > 1 && (
            <div className="flex justify-center gap-1 mt-3 pt-2 border-t border-border/30">
              {messages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToMessage(idx)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    idx === currentIndex 
                      ? "bg-accent w-3" 
                      : "bg-border hover:bg-text-tertiary"
                  )}
                  aria-label={`Ga naar bericht ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { defaultAiMessages, defaultChannel };
export type { Message, Channel, ChatPreviewProps };
