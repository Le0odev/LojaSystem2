"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import axios, { type AxiosError } from "axios"
import { FaPlus, FaMinus } from "react-icons/fa"
import { useAuth } from "../Login/authContext"
import {
  VendaContainer,
  SearchSection,
  VendaSection,
  Form,
  Label,
  Input,
  ProductGrid,
  ProductImage,
  ProductName,
  ProductPrice,
  Button,
  EmptyCartMessage,
  CartList,
  CartItem,
  CartItemDetails,
  CartItemName,
  CartItemPrice,
  QuantityControl,
  TrashIcon,
  GranelInput,
  SubtotalContainer,
  SubtotalLabel,
  SubtotalAmount,
  CheckoutSection,
  CheckoutButton,
  ModalWrapper,
  ModalContent,
  ProductCard2,
  PaymentButtonsContainer,
  PaymentButton,
  CartActions,
  LabelPeso,
  PriceDiv,
  DecrementButton,
  QuantityDisplay,
  IncrementButton,
  AlertMessage,
} from "./StyledVenda"
import jsPDF from "jspdf"
import { toast } from "react-toastify"
import { SearchBar, SearchContainer, SearchIcon } from "../../components/StyledSearch"
import { FiSearch } from "react-icons/fi"
import PixModalVenda from "./PixModalVenda"
import { CancelButton } from "../ProductCad/StyledProdutos"

interface Produto {
  id: number
  productName: string
  productPrice: number
  quantidade: number | null
  peso?: number | null
  bulk: boolean
  imageUrl: string
  productQuantity: number
  estoquePeso: number
}

interface ErrorResponse {
  message: string
}

const CriarVenda: React.FC = () => {
  const { token } = useAuth()
  const [searchTermByName, setSearchTermByName] = useState<string>("")
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<Produto[]>([])
  const [autoAddFeedback, setAutoAddFeedback] = useState<string>("")
  const [codigoBarras, setCodigoBarras] = useState<string>("")
  const [desconto, setDesconto] = useState<number>(0)
  const [formaDePagamento, setFormaDePagamento] = useState<string>("")
  const [showModal, setShowModal] = useState<boolean>(false)
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [searchTermByCodeBar, setSearchTermByCodeBar] = useState<string>("")

  const toggleModal = () => setShowModal(!showModal)
  const togglePrintModal = () => setShowPrintModal(!showPrintModal)

  const removeLeadingZeros = (code: string): string => {
    return code.replace(/^0+/, "")
  }

  const searchProdutosByCodeBar = async (codeBar: string) => {
    try {
      if (codeBar.startsWith("20") && codeBar.length === 13) {
        // Handling bulk product (a granel)
        const productCode = removeLeadingZeros(codeBar.substring(1, 5))
        const priceInCents = Number.parseInt(codeBar.substring(7, 12))
        const totalPrice = priceInCents / 100

        // Buscar o produto no banco de dados
        const response = await axios.get(
          `https://systemallback-end-production.up.railway.app/products/search/codebar?codeBar=${productCode}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        const produtoEncontrado = response.data[0] // Supondo que a API retorne um array de resultados

        if (produtoEncontrado) {
          const productPrice = produtoEncontrado.productPrice || 0
          if (productPrice > 0) {
            // Calcular o peso em gramas baseado no preço total da etiqueta e no preço por kg do produto
            const weightInGrams = Math.round((totalPrice / productPrice) * 1000)

            const produtoComPeso = {
              ...produtoEncontrado,
              peso: weightInGrams, // Peso do produto a granel em gramas
              bulk: true, // Marcar como produto a granel
            }
            addToCart(produtoComPeso) // Adicionar ao carrinho
            setAutoAddFeedback(
              `Produto "${produtoEncontrado.productName}" (${weightInGrams}g) adicionado automaticamente.`,
            )
          } else {
            setAutoAddFeedback(`Erro: Preço do produto "${produtoEncontrado.productName}" inválido no sistema.`)
          }
          setSearchTermByName("") // Limpar o input após sucesso
        } else {
          setAutoAddFeedback("Produto a granel não encontrado.")
        }
      } else {
        // Lógica para produtos não a granel (por unidade)
        const productCode = removeLeadingZeros(codeBar)

        const response = await axios.get(
          `https://systemallback-end-production.up.railway.app/products/search/codebar?codeBar=${productCode}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        const produtoEncontrado = response.data[0]

        if (produtoEncontrado) {
          addToCart(produtoEncontrado)
          setAutoAddFeedback(`Produto "${produtoEncontrado.productName}" adicionado automaticamente.`)
          setSearchTermByName("") // Limpar o input após sucesso
        } else {
          setAutoAddFeedback("Produto não encontrado.")
        }
      }

      // Resetar o campo de busca
      setTimeout(() => setAutoAddFeedback(""), 3000)
    } catch (error) {
      console.error("Erro ao buscar produtos por código de barras:", error)
      setAutoAddFeedback("Erro ao buscar produto. Tente novamente.")
    }
  }

  const searchProdutosByName = useCallback(
    async (term: string) => {
      try {
        const response = await axios.get(
          `https://systemallback-end-production.up.railway.app/products/search?productName=${term}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        setProdutos(response.data)
      } catch (error) {
        console.error("Erro ao buscar produtos:", error)
        setProdutos([])
      }
    },
    [token],
  )

  const addToCart = (produto: Produto) => {
    const itemExistente = carrinho.find((item) => item.id === produto.id)

    if (itemExistente) {
      const novoCarrinho = carrinho.map((item) =>
        item.id === produto.id
          ? {
              ...item,
              quantidade: item.bulk ? item.quantidade : (item.quantidade || 0) + 1,
              peso: item.bulk ? (item.peso || 0) + (produto.peso || 0) : item.peso,
            }
          : item,
      )
      setCarrinho(novoCarrinho)
    } else {
      setCarrinho([
        {
          ...produto,
          quantidade: produto.bulk ? 1 : 1,
          peso: produto.bulk ? produto.peso : null,
        },
        ...carrinho,
      ])
    }

    setCodigoBarras("")
  }

  const updateQuantity = (id: number, quantidade: number | null) => {
    setCarrinho((prevCarrinho) =>
      prevCarrinho
        .map((item) => (item.id === id ? { ...item, quantidade: quantidade } : item))
        .filter((item) => item.quantidade !== undefined && item.quantidade !== null && item.quantidade > 0),
    )
  }

  const updateWeight = (id: number, peso: number | null) => {
    setCarrinho((prevCarrinho) => prevCarrinho.map((item) => (item.id === id ? { ...item, peso: peso } : item)))
  }

  const removeFromCart = (id: number) => {
    setCarrinho((prevCarrinho) => prevCarrinho.filter((item) => item.id !== id))
  }

  const handlePixConfirmation = async () => {
    try {
      await handleCheckout()
      setShowPixModal(false)
    } catch (error) {
      console.error("Erro ao processar pagamento PIX:", error)
      toast.error("Erro ao processar o pagamento. Por favor, tente novamente.")
    }
  }

  const handleCheckout = async () => {
    try {
      if (!formaDePagamento) {
        toast.warning("Por favor, preencha a forma de pagamento antes de finalizar a venda.")
        return
      }

      if (formaDePagamento === "PIX" && !showPixModal) {
        setShowPixModal(true)
        return
      }

      const vendaItems = carrinho.map((item) => ({
        productId: item.id,
        quantity: item.bulk ? null : item.quantidade,
        weight: item.bulk ? item.peso : null,
        isBulk: item.bulk,
      }))

      const saleRequest = {
        itemsSale: vendaItems,
        discount: desconto,
        methodPayment: formaDePagamento,
      }

      const response = await axios.post(
        "https://systemallback-end-production.up.railway.app/sales/create",
        saleRequest,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      )

      setCarrinho([])
      setShowPrintModal(true)
      toggleModal()
      setAutoAddFeedback("")
      setSearchTermByName("")
      setDesconto(0)
      toast.success("Venda finalizada com sucesso.")

      handlePrintReceipt()
    } catch (error) {
      console.error("Erro ao realizar checkout:", error)

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ErrorResponse>

        let errorMessage = "Erro ao finalizar a venda. Por favor, tente novamente mais tarde."

        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message
        }

        toast.error(errorMessage)
      } else {
        toast.error("Erro desconhecido ao finalizar a venda. Por favor, tente novamente mais tarde.")
      }
    }
  }

  useEffect(() => {
    if (carrinho.length === 0) {
      setDesconto(0)
    }
  }, [carrinho])

  const calcularSubtotal = () => {
    let subtotal = 0

    carrinho.forEach((item) => {
      if (item.bulk) {
        subtotal += (item.productPrice * (item.peso || 0)) / 1000
      } else {
        subtotal += item.productPrice * (item.quantidade || 0)
      }
    })

    const descontoPercentual = desconto || 0
    const subtotalComDesconto = subtotal - subtotal * (descontoPercentual / 100)

    return { subtotal, subtotalComDesconto }
  }

  const handleSearchByNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    searchProdutosByName(searchTermByName)
  }

  const handleSearchByCodeBarSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    searchProdutosByCodeBar(searchTermByCodeBar)
  }

  // Modifique a função handlePrintReceipt para aceitar dados opcionais
  const handlePrintReceipt = () => {
    const carrinhoParaImprimir = carrinho
    const descontoParaImprimir = desconto
    const formaDePagamentoParaImprimir = formaDePagamento

    const pageWidth = 80
    const pageHeight = 297
    const margins = { top: 10, right: 5, bottom: 10, left: 5 }
    const lineHeight = 5

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight],
    })

    let currentY = margins.top

    const addPage = () => {
      doc.addPage([pageWidth, pageHeight])
      currentY = margins.top
    }

    const writeText = (text: string, fontSize = 10, isBold = false) => {
      doc.setFontSize(fontSize)
      doc.setFont("helvetica", isBold ? "bold" : "normal")

      const textLines = doc.splitTextToSize(text, pageWidth - margins.left - margins.right)
      textLines.forEach((line: string) => {
        if (currentY + lineHeight > pageHeight - margins.bottom) {
          addPage()
        }
        doc.text(line, margins.left, currentY)
        currentY += lineHeight
      })
    }

    const drawLine = () => {
      if (currentY + 1 > pageHeight - margins.bottom) {
        addPage()
      }
      doc.line(margins.left, currentY, pageWidth - margins.right, currentY)
      currentY += lineHeight
    }

    // Header
    writeText("Cupom de Compra", 14, true)
    writeText("Empório Verde Grãos")
    writeText("CNPJ: 34.483.095/0001-63")
    writeText("Centro, Abreu e Lima")
    writeText("(81) 9 9167-6177")
    writeText(`Data e Hora: ${new Date().toLocaleString("pt-BR")}`)
    drawLine()

    // Items
    carrinhoParaImprimir.forEach((item) => {
      writeText(item.productName, 12, true)
      writeText(`Preço: R$ ${item.productPrice.toFixed(2)}`)
      writeText(item.bulk ? `Peso: ${item.peso}g` : `Quantidade: ${item.quantidade}`)
      writeText(
        `Subtotal: R$ ${
          item.bulk
            ? ((item.productPrice * (item.peso || 0)) / 1000).toFixed(2)
            : (item.productPrice * (item.quantidade || 0)).toFixed(2)
        }`,
      )
      drawLine()
    })

    // Totals
    const calcularSubtotalTeste = (carrinhoTeste: Produto[], descontoTeste: number) => {
      const subtotal = carrinhoTeste.reduce((total, item) => {
        if (item.bulk) {
          return total + (item.productPrice * (item.peso || 0)) / 1000
        } else {
          return total + item.productPrice * (item.quantidade || 0)
        }
      }, 0)

      const subtotalComDesconto = subtotal - subtotal * (descontoTeste / 100)
      return { subtotal, subtotalComDesconto }
    }

    const { subtotal, subtotalComDesconto } = calcularSubtotalTeste(carrinhoParaImprimir, descontoParaImprimir)

    writeText(`Subtotal: R$ ${subtotal.toFixed(2)}`, 12)
    writeText(`Desconto: R$ ${(subtotal - subtotalComDesconto).toFixed(2)}`, 12)
    writeText(`Total: R$ ${subtotalComDesconto.toFixed(2)}`, 12, true)
    writeText(`Pagamento: ${formaDePagamentoParaImprimir}`, 12)

    drawLine()
    writeText("Obrigado pela preferência!", 10, true)

    const pdfBlob = doc.output("blob") as Blob
    printPDF(pdfBlob)
  }

  const printPDF = (pdfBlob: Blob) => {
    const pdfUrl = URL.createObjectURL(pdfBlob)

    const printWindow = window.open(pdfUrl)

    if (!printWindow) {
      alert(
        "Não foi possível abrir a janela de impressão. Verifique se as configurações do navegador permitem abrir novas janelas.",
      )
      return
    }

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        URL.revokeObjectURL(pdfUrl)
      }, 1000)
    }
  }

  const generatePixCode = () => {
    return Date.now().toString()
  }

  useEffect(() => {
    if (searchTermByName) {
      const debounceSearch = setTimeout(() => {
        if (/^\d+$/.test(searchTermByName)) {
          searchProdutosByCodeBar(searchTermByName)
        } else {
          searchProdutosByName(searchTermByName)
        }
      }, 300)

      return () => clearTimeout(debounceSearch)
    } else {
      setProdutos([])
    }
  }, [searchTermByName, searchProdutosByName, searchProdutosByCodeBar])

  const { subtotal, subtotalComDesconto } = calcularSubtotal()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 - Focus search
      if (e.key === "F2") {
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
      // F4 - Finish sale
      if (e.key === "F4") {
        if (carrinho.length > 0) {
          setShowModal(true)
        }
      }
      // F8 - Quick payment with PIX
      if (e.key === "F8") {
        if (carrinho.length > 0) {
          setFormaDePagamento("PIX")
          setShowPixModal(true)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [carrinho.length])

  return (
    <VendaContainer>
      <SearchSection>
        <Form onSubmit={handleSearchByNameSubmit}>
        <Label>Buscar por nome ou código de barras // ( F2 )</Label>
          <SearchContainer>
            <SearchIcon>
              <FiSearch />
            </SearchIcon>
            <SearchBar
              type="text"
              placeholder="Buscar por nome ou código de barras..."
              value={searchTermByName}
              onChange={(e) => setSearchTermByName(e.target.value)}
              onKeyDown={(e) => {
                // Enter key triggers search
                if (e.key === "Enter") {
                  e.preventDefault()
                  // If input looks like a barcode (only numbers), use barcode search
                  if (/^\d+$/.test(searchTermByName)) {
                    searchProdutosByCodeBar(searchTermByName)
                  } else {
                    searchProdutosByName(searchTermByName)
                  }
                }
                // F2 key focuses the search input
                if (e.key === "F2") {
                  e.currentTarget.focus()
                }
              }}
            />
          </SearchContainer>
          <Button type="submit">Pesquisar</Button>
        </Form>
        {autoAddFeedback && (
          <AlertMessage error={autoAddFeedback.includes("não encontrado")}>{autoAddFeedback}</AlertMessage>
        )}
        <ProductGrid>
          {produtos.map((produto) => (
            <ProductCard2
              key={produto.id}
              onClick={() => {
                addToCart(produto)
                setSearchTermByName("") // Limpar o input após adicionar o produto
                setProdutos([]) // Limpar os resultados da busca
              }}
            >
              <ProductImage src={produto.imageUrl} alt={produto.productName} />
              <ProductName>{produto.productName}</ProductName>
              <ProductPrice>
                {produto.productPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </ProductPrice>
              <Button type="button">Adicionar</Button>
            </ProductCard2>
          ))}
        </ProductGrid>
      </SearchSection>
      <VendaSection>
        <Label>Checkout</Label>
        <CartList>
          {carrinho.length === 0 ? (
            <EmptyCartMessage>Seu carrinho está vazio.</EmptyCartMessage>
          ) : (
            carrinho.map((item) => (
              <CartItem key={item.id}>
                <CartItemDetails>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.productName}
                      style={{ width: "50px", height: "50px", marginRight: "10px" }}
                    />
                    <div>
                      <CartItemName>{item.productName}</CartItemName>

                      {item.bulk ? (
                        <div>
                          <LabelPeso>Disponivel: {item.estoquePeso}KG</LabelPeso>
                          <PriceDiv>R${item.productPrice.toFixed(2)}/kg</PriceDiv>
                          <GranelInput
                            placeholder="Gramas:"
                            type="number"
                            id={`weight_${item.id}`}
                            value={item.peso || ""}
                            onChange={(e) => updateWeight(item.id, Number.parseFloat(e.target.value))}
                          />
                          <CartItemPrice>
                            Subtotal:{" "}
                            {((item.productPrice * (item.peso || 0)) / 1000).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </CartItemPrice>
                        </div>
                      ) : (
                        <div>
                          <LabelPeso>Disponível: {item.productQuantity}UN</LabelPeso>
                          <PriceDiv>R$: {item.productPrice.toFixed(2)}</PriceDiv>
                          <QuantityControl>
                            <DecrementButton onClick={() => updateQuantity(item.id, (item.quantidade || 0) - 1)}>
                              <FaMinus />
                            </DecrementButton>
                            <QuantityDisplay>{item.quantidade}</QuantityDisplay>
                            <IncrementButton onClick={() => updateQuantity(item.id, (item.quantidade || 0) + 1)}>
                              <FaPlus />
                            </IncrementButton>
                          </QuantityControl>
                          <CartItemPrice>
                            Subtotal:{" "}
                            {(item.productPrice * (item.quantidade || 0)).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </CartItemPrice>
                        </div>
                      )}
                    </div>
                  </div>
                  <CartActions>
                    <TrashIcon onClick={() => removeFromCart(item.id)} />
                  </CartActions>
                </CartItemDetails>
              </CartItem>
            ))
          )}
        </CartList>
        {carrinho.length > 0 && (
          <CheckoutSection>
            <Form>
              <Label htmlFor="desconto">Desconto (%):</Label>
              <Input
                placeholder="Insira o desconto..."
                type="number"
                id="desconto"
                value={desconto || ""}
                onChange={(e) => setDesconto(Number.parseFloat(e.target.value))}
              />
            </Form>
            <PaymentButtonsContainer>
              <PaymentButton onClick={() => setFormaDePagamento("Cartão")} selected={formaDePagamento === "Cartão"}>
                Cartão
              </PaymentButton>
              <PaymentButton onClick={() => setFormaDePagamento("Dinheiro")} selected={formaDePagamento === "Dinheiro"}>
                Dinheiro
              </PaymentButton>
              <PaymentButton onClick={() => setFormaDePagamento("PIX")} selected={formaDePagamento === "PIX"}>
                PIX  ( F8 )
              </PaymentButton>
            </PaymentButtonsContainer>
            <SubtotalContainer>
              <SubtotalLabel>Subtotal:</SubtotalLabel>
              <SubtotalAmount>R$ {subtotalComDesconto.toFixed(2)}</SubtotalAmount>
            </SubtotalContainer>
            <CheckoutButton onClick={() => setShowModal(true)}>Finalizar Venda  ( F4 )</CheckoutButton>
          </CheckoutSection>
        )}
      </VendaSection>
      <PixModalVenda
        isOpen={showPixModal}
        onClose={() => {
          setShowPixModal(false)
          handleCheckout()
        }}
        subtotal={calcularSubtotal().subtotalComDesconto}
        onCancel={() => setShowPixModal(false)}
        fullPIX={generatePixCode()}
        now={Date.now()}
      />

      {showModal && (
        <ModalWrapper>
          <ModalContent>
            <h2>Deseja finalizar a venda?</h2>
            <div>
              <Button onClick={handleCheckout}>Confirmar</Button>
              <CancelButton onClick={() => setShowModal(false)}>Cancelar</CancelButton>
            </div>
          </ModalContent>
        </ModalWrapper>
      )}
    </VendaContainer>
  )
}

export { CriarVenda }

