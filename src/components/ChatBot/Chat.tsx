"use client"

import type React from "react"

import { useState } from "react"
import axios from "axios"
import { MessageCircle, Send } from "lucide-react"
import { ChatContainer, InputField, SendButton, ChatBox, Message, Header, InputContainer } from "./ChatSyled"
import ProductCards from "./ProductCard"

interface ChatMessage {
  texto: string
  isUser: boolean
}

interface ChatResponse {
  resposta: string
  produtos_relacionados: any[]
  intent_detected: string
}

const Chat = () => {
  const [pergunta, setPergunta] = useState("")
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [produtosRelacionados, setProdutosRelacionados] = useState<any[]>([])

  const enviarPergunta = async () => {
    if (!pergunta.trim()) return

    // Add user message to chat
    setMensagens((prevMensagens) => [...prevMensagens, { texto: pergunta, isUser: true }])
    setIsLoading(true)

    try {
      const response = await axios.post<ChatResponse>(
        "http://localhost:8000/chat",
        {
          question: pergunta,
          user_id: null,
          session_id: null,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      console.log("Resposta recebida:", response.data) // Debug log

      // Check if response has the expected structure
      if (response.data) {
        // Make sure resposta exists before adding to messages
        const respostaTexto = response.data.resposta || "Não foi possível obter uma resposta clara."

        setMensagens((prevMensagens) => [...prevMensagens, { texto: respostaTexto, isUser: false }])

        // Update related products if they exist
        if (Array.isArray(response.data.produtos_relacionados) && response.data.produtos_relacionados.length > 0) {
          setProdutosRelacionados(response.data.produtos_relacionados)
        } else {
          setProdutosRelacionados([])
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar resposta:", error)

      // Detailed error logging
      if (error.response) {
        console.error("Response data:", error.response.data)
        console.error("Response status:", error.response.status)
      }

      const errorMessage =
        error.response?.data?.detail || error.response?.data?.message || "Erro ao obter resposta. Tente novamente!"

      setMensagens((prevMensagens) => [
        ...prevMensagens,
        { texto: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage), isUser: false },
      ])
    } finally {
      setIsLoading(false)
      setPergunta("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      enviarPergunta()
    }
  }

  return (
    <ChatContainer>
      <Header>
        <MessageCircle />
        Assistente
      </Header>
      <ChatBox>
        {mensagens.length === 0 ? (
          <Message isUser={false}>Olá! Como posso ajudar você hoje?</Message>
        ) : (
          mensagens.map((msg, index) => (
            <Message key={index} isUser={msg.isUser}>
              {msg.texto}
            </Message>
          ))
        )}

        {isLoading && <Message isUser={false}>Digitando...</Message>}

        {produtosRelacionados.length > 0 && <ProductCards produtos={produtosRelacionados} />}
      </ChatBox>
      <InputContainer>
        <InputField
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua pergunta..."
          disabled={isLoading}
        />
        <SendButton onClick={enviarPergunta} disabled={isLoading || !pergunta.trim()}>
          <Send />
        </SendButton>
      </InputContainer>
    </ChatContainer>
  )
}

export default Chat

