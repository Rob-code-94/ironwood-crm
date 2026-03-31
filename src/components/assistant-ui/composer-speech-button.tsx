"use client"

import * as React from "react"
import { MicIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const TEXTAREA_SELECTOR = "textarea.aui-composer-input, textarea[aria-label='Message input']"

function appendToComposer(text: string) {
  const input = document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR)
  if (!input) return false
  const prefix = input.value.length > 0 ? `${input.value.trimEnd()} ` : ""
  const nextValue = `${prefix}${text}`
  const setNativeValue = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set
  setNativeValue?.call(input, nextValue)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.focus()
  return true
}

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onerror: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: RecognitionResultEvent) => void) | null
  start: () => void
  stop: () => void
}

export function ComposerSpeechButton() {
  const [listening, setListening] = React.useState(false)
  const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null)

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  const toggle = React.useCallback(() => {
    if (!supported) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const host = window as Window & {
      SpeechRecognition?: new () => unknown
      webkitSpeechRecognition?: new () => unknown
    }

    const SpeechRecognitionCtor = host.SpeechRecognition ?? host.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor() as unknown as BrowserSpeechRecognition
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.onresult = (event: RecognitionResultEvent) => {
      const text = event.results[0]?.[0]?.transcript?.trim()
      if (text) appendToComposer(text)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [listening, supported])

  if (!supported) return null

  return (
    <Button
      type="button"
      variant={listening ? "default" : "ghost"}
      size="icon"
      className="size-8 shrink-0 rounded-full"
      title={listening ? "Stop dictation" : "Dictate message"}
      aria-label={listening ? "Stop dictation" : "Dictate message"}
      aria-pressed={listening}
      onClick={toggle}
    >
      <MicIcon className="size-4" />
    </Button>
  )
}
