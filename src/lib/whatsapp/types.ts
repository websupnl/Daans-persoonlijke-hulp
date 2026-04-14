// Meta WhatsApp Cloud API types
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface WhatsAppWebhookPayload {
  object: string
  entry: WhatsAppEntry[]
}

export interface WhatsAppEntry {
  id: string
  changes: WhatsAppChange[]
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue
  field: string
}

export interface WhatsAppChangeValue {
  messaging_product: string
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
  statuses?: WhatsAppStatus[]
  errors?: WhatsAppError[]
}

export interface WhatsAppContact {
  profile: { name: string }
  wa_id: string
}

export interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive' | 'button' | 'unknown'
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string }
  audio?: { id: string; mime_type: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
  button?: { text: string; payload: string }
}

export interface WhatsAppStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
}

export interface WhatsAppError {
  code: number
  title: string
  message?: string
  error_data?: { details: string }
}

// Normalized inbound message for internal use
export interface NormalizedWhatsAppMessage {
  messageId: string
  from: string
  senderName: string
  text: string
  timestamp: Date
  phoneNumberId: string
  raw: WhatsAppMessage
}

// Outbound message types
export interface SendTextMessageOptions {
  to: string
  text: string
  previewUrl?: boolean
}

export interface SendMessageResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

// Internal ingest request/response
export interface IngestRequest {
  message: string
  source: 'whatsapp' | 'chat' | 'api'
  senderPhone?: string
  senderName?: string
}

export interface IngestResponse {
  reply: string
  actions: unknown[]
  parserType: string
  confidence: number
}
