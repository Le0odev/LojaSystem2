"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import axios, { type AxiosError } from "axios"
import { FaPlus, FaMinus, FaSave, FaList } from "react-icons/fa"
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
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProvided, type DraggableProvided } from "react-beautiful-dnd"

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

interface PaymentMethod {
  method: string
  amount: number
  id: string
}

interface SavedTransaction {
  id: string
  carrinho: Produto[]
  desconto: number
  timestamp: number
  customerName?: string
}

interface PixModalVendaProps {
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  subtotal: number
  fullPIX: string
  now: number
}

const CriarVenda: React.FC = () => {
  const { token } = useAuth()
  const [searchTermByName, setSearchTermByName] = useState<string>("")
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<Produto[]>([])
  const [autoAddFeedback, setAutoAddFeedback] = useState<string>("")
  const [desconto, setDesconto] = useState<number>(0)
  const [formaDePagamento, setFormaDePagamento] = useState<string>("")
  const [showModal, setShowModal] = useState<boolean>(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState<boolean>(false)
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<string>("Cartão")
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState<string>("")
  const [savedTransactions, setSavedTransactions] = useState<SavedTransaction[]>([])
  const [showSavedTransactionsModal, setShowSavedTransactionsModal] = useState<boolean>(false)
  const [customerName, setCustomerName] = useState<string>("")
  const [showSaveTransactionModal, setShowSaveTransactionModal] = useState<boolean>(false)

  const toggleModal = () => setShowModal(!showModal)

  const removeLeadingZeros = (code: string): string => {
    return code.replace(/^0+/, "")
  }

  const searchProdutosByCodeBar = async (codeBar: string) => {
    try {
      if (codeBar.startsWith("20") && codeBar.length === 13) {
        const productCode = removeLeadingZeros(codeBar.substring(2, 7))
        const weightInGrams = Number.parseInt(codeBar.substring(7, 12))

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
          const produtoComPeso = {
            ...produtoEncontrado,
            peso: weightInGrams,
            bulk: true,
          }
          addToCart(produtoComPeso)
          setAutoAddFeedback(`Produto "${produtoEncontrado.productName}" (${weightInGrams}g) adicionado automaticamente.`)
          setSearchTermByName("")
        } else {
          setAutoAddFeedback("Produto a granel não encontrado.")
        }
      } else {
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
          setSearchTermByName("")
        } else {
          setAutoAddFeedback("Produto não encontrado.")
        }
      }
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
  }

  const updateQuantity = (id: number, quantidade: number | null) => {
    setCarrinho((prevCarrinho) =>
      prevCarrinho
        .map((item) => (item.id === id ? { ...item, quantidade } : item))
        .filter((item) => item.quantidade !== null && item.quantidade > 0),
    )
  }

  const updateWeight = (id: number, peso: number | null) => {
    setCarrinho((prevCarrinho) => prevCarrinho.map((item) => (item.id === id ? { ...item, peso } : item)))
  }

  const removeFromCart = (id: number) => {
    setCarrinho((prevCarrinho) => prevCarrinho.filter((item) => item.id !== id))
  }

  const handleCheckout = async () => {
    try {
      if (paymentMethods.length > 0) {
        const totalPaymentAmount = paymentMethods.reduce((sum, method) => sum + method.amount, 0)
        const { subtotalComDesconto } = calcularSubtotal()
        if (Math.abs(totalPaymentAmount - subtotalComDesconto) > 0.01) {
          toast.warning(
            `O valor total dos pagamentos (R$${totalPaymentAmount.toFixed(2)}) não corresponde ao valor da venda (R$${subtotalComDesconto.toFixed(2)}).`,
          )
          return
        }

        const vendaItems = carrinho.map((item) => ({
          productId: item.id,
          quantity: item.bulk ? null : item.quantidade,
          weight: item.bulk ? item.peso : null,
          isBulk: item.bulk,
        }))

        const paymentMethodsForAPI = paymentMethods.map((method) => ({
          method: method.method,
          amount: method.amount,
        }))

        const saleRequest = {
          itemsSale: vendaItems,
          discount: desconto,
          paymentMethods: paymentMethodsForAPI,
        }

        await axios.post(
          "https://systemallback-end-production.up.railway.app/sales/create",
          saleRequest,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )

        resetSaleState()
        toast.success("Venda finalizada com sucesso.")
        handlePrintReceipt()
      } else if (!formaDePagamento) {
        toast.warning("Por favor, preencha a forma de pagamento antes de finalizar a venda.")
        return
      } else if (formaDePagamento === "PIX" && !showPixModal) {
        setShowPixModal(true)
        return
      } else {
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

        await axios.post(
          "https://systemallback-end-production.up.railway.app/sales/create",
          saleRequest,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )

        resetSaleState()
        toast.success("Venda finalizada com sucesso.")
        handlePrintReceipt()
      }
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

  const resetSaleState = () => {
    setCarrinho([])
    toggleModal()
    setAutoAddFeedback("")
    setSearchTermByName("")
    setDesconto(0)
    setPaymentMethods([])
    setFormaDePagamento("")
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

  const handlePrintReceipt = () => {
    const carrinhoParaImprimir = carrinho
    const descontoParaImprimir = desconto
    const formaDePagamentoParaImprimir = paymentMethods.length > 0 ? "Pagamento Dividido" : formaDePagamento

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

    writeText("Cupom de Compra", 14, true)
    writeText("Empório Verde Grãos")
    writeText("CNPJ: 34.483.095/0001-63")
    writeText("Centro, Abreu e Lima")
    writeText("(81) 9 9167-6177")
    writeText(`Data e Hora: ${new Date().toLocaleString("pt-BR")}`)
    drawLine()

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

    if (paymentMethods.length > 0) {
      writeText("Formas de Pagamento:", 12, true)
      paymentMethods.forEach((method) => {
        writeText(`${method.method}: R$ ${method.amount.toFixed(2)}`, 10)
      })
    } else {
      writeText(`Pagamento: ${formaDePagamentoParaImprimir}`, 12)
    }

    drawLine()
    writeText("Obrigado pela preferência!", 10, true)

    const pdfBlob = doc.output("blob") as Blob
    printPDF(pdfBlob)
  }

  const printPDF = (pdfBlob: Blob) => {
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const printWindow = window.open(pdfUrl)
    if (!printWindow) {
      alert("Não foi possível abrir a janela de impressão. Verifique as configurações do navegador.")
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
  }, [searchTermByName, searchProdutosByName])

  const { subtotal, subtotalComDesconto } = calcularSubtotal()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
        if (searchInput) searchInput.focus()
      }
      if (e.key === "F4" && carrinho.length > 0) {
        setShowModal(true)
      }
      if (e.key === "F8" && carrinho.length > 0) {
        setFormaDePagamento("PIX")
        setShowPixModal(true)
      }
      if (e.key === "F6" && carrinho.length > 0) {
        setShowSaveTransactionModal(true)
      }
      if (e.key === "F7") {
        setShowSavedTransactionsModal(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [carrinho.length])

  useEffect(() => {
    const savedTransactionsData = localStorage.getItem("savedTransactions")
    if (savedTransactionsData) {
      try {
        const parsedData = JSON.parse(savedTransactionsData)
        setSavedTransactions(parsedData)
      } catch (error) {
        console.error("Error parsing saved transactions:", error)
      }
    }
  }, [])

  const addPaymentMethod = () => {
    if (!currentPaymentMethod) {
      toast.warning("Selecione um método de pagamento.")
      return
    }
    const amount = Number.parseFloat(currentPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.warning("Insira um valor válido para o pagamento.")
      return
    }
    const currentTotal = paymentMethods.reduce((sum, method) => sum + method.amount, 0) + amount
    const { subtotalComDesconto } = calcularSubtotal()
    if (currentTotal > subtotalComDesconto + 0.01) {
      toast.warning(
        `O valor total dos pagamentos (R$${currentTotal.toFixed(2)}) excede o valor da venda (R$${subtotalComDesconto.toFixed(2)}).`,
      )
      return
    }
    const newPaymentMethod: PaymentMethod = {
      method: currentPaymentMethod,
      amount,
      id: Date.now().toString(),
    }
    setPaymentMethods([...paymentMethods, newPaymentMethod])
    setCurrentPaymentAmount("")
  }

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter((method) => method.id !== id))
  }

  const saveTransaction = () => {
    if (carrinho.length === 0) {
      toast.warning("Não há itens no carrinho para salvar.")
      return
    }
    const newTransaction: SavedTransaction = {
      id: Date.now().toString(),
      carrinho: [...carrinho],
      desconto,
      timestamp: Date.now(),
      customerName: customerName || "Cliente não identificado",
    }
    const updatedTransactions = [...savedTransactions, newTransaction]
    setSavedTransactions(updatedTransactions)
    localStorage.setItem("savedTransactions", JSON.stringify(updatedTransactions))
    toast.success("Venda salva com sucesso!")
    setShowSaveTransactionModal(false)
    setCustomerName("")
    setCarrinho([])
    setDesconto(0)
    setPaymentMethods([])
    setFormaDePagamento("")
  }

  const restoreTransaction = (transaction: SavedTransaction) => {
    if (carrinho.length > 0 && !window.confirm("Há itens no carrinho atual. Deseja substituí-los pela venda salva?")) {
      return
    }
    setCarrinho(transaction.carrinho)
    setDesconto(transaction.desconto)
    setShowSavedTransactionsModal(false)
    const updatedTransactions = savedTransactions.filter((t) => t.id !== transaction.id)
    setSavedTransactions(updatedTransactions)
    localStorage.setItem("savedTransactions", JSON.stringify(updatedTransactions))
    toast.success("Venda restaurada com sucesso!")
  }

  const deleteSavedTransaction = (id: string) => {
    const updatedTransactions = savedTransactions.filter((t) => t.id !== id)
    setSavedTransactions(updatedTransactions)
    localStorage.setItem("savedTransactions", JSON.stringify(updatedTransactions))
    toast.success("Venda removida com sucesso!")
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(carrinho)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)
    setCarrinho(items)
  }

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
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (/^\d+$/.test(searchTermByName)) {
                    searchProdutosByCodeBar(searchTermByName)
                  } else {
                    searchProdutosByName(searchTermByName)
                  }
                }
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
                setSearchTermByName("")
                setProdutos([])
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <Label>Checkout</Label>
          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              onClick={() => setShowSaveTransactionModal(true)}
              style={{ padding: "5px 10px", fontSize: "0.9rem" }}
            >
              <FaSave style={{ marginRight: "5px" }} /> Salvar Venda (F6)
            </Button>
            <Button
              onClick={() => setShowSavedTransactionsModal(true)}
              style={{ padding: "5px 10px", fontSize: "0.9rem" }}
            >
              <FaList style={{ marginRight: "5px" }} /> Vendas Salvas (F7)
            </Button>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="carrinho">
            {(provided: DroppableProvided) => (
              <CartList
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {carrinho.length === 0 ? (
                  <EmptyCartMessage>Seu carrinho está vazio.</EmptyCartMessage>
                ) : (
                  carrinho.map((item, index) => (
                    <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                      {(provided: DraggableProvided) => (
                        <CartItem
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
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
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </CartList>
            )}
          </Droppable>
        </DragDropContext>

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

            <div style={{ marginBottom: "10px" }}>
              <Button
                onClick={() => setShowSplitPaymentModal(true)}
                style={{ width: "100%", marginBottom: "10px" }}
              >
                Pagamento Dividido
              </Button>
            </div>

            {paymentMethods.length === 0 && (
              <PaymentButtonsContainer>
                <PaymentButton onClick={() => setFormaDePagamento("Cartão")} selected={formaDePagamento === "Cartão"}>
                  Cartão
                </PaymentButton>
                <PaymentButton onClick={() => setFormaDePagamento("Dinheiro")} selected={formaDePagamento === "Dinheiro"}>
                  Dinheiro
                </PaymentButton>
                <PaymentButton onClick={() => setFormaDePagamento("PIX")} selected={formaDePagamento === "PIX"}>
                  PIX ( F8 )
                </PaymentButton>
              </PaymentButtonsContainer>
            )}

            {paymentMethods.length > 0 && (
              <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "5px", padding: "10px" }}>
                <Label style={{ marginBottom: "10px", display: "block" }}>Formas de Pagamento:</Label>
                {paymentMethods.map(method => (
                  <div key={method.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span>{method.method}</span>
                    <div>
                      <span style={{ marginRight: "10px" }}>R$ {method.amount.toFixed(2)}</span>
                      <button
                        onClick={() => removePaymentMethod(method.id)}
                        style={{ background: "none", border: "none", color: "red", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #ddd", paddingTop: "5px", display: "flex", justifyContent: "space-between" }}>
                  <span><strong>Total:</strong></span>
                  <span>R$ {paymentMethods.reduce((sum, method) => sum + method.amount, 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            <SubtotalContainer>
              <SubtotalLabel>Subtotal:</SubtotalLabel>
              <SubtotalAmount>R$ {subtotalComDesconto.toFixed(2)}</SubtotalAmount>
            </SubtotalContainer>
            <CheckoutButton onClick={() => setShowModal(true)}>Finalizar Venda ( F4 )</CheckoutButton>
          </CheckoutSection>
        )}
      </VendaSection>

      <PixModalVenda
        isOpen={showPixModal}
        onClose={() => {
          setShowPixModal(false)
          handleCheckout()
        }}
        onCancel={() => setShowPixModal(false)}
        subtotal={calcularSubtotal().subtotalComDesconto}
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

      {showSplitPaymentModal && (
        <ModalWrapper>
          <ModalContent>
            <h2>Pagamento Dividido</h2>
            <p>Valor total: R$ {subtotalComDesconto.toFixed(2)}</p>
            <p>Valor restante: R$ {(subtotalComDesconto - paymentMethods.reduce((sum, method) => sum + method.amount, 0)).toFixed(2)}</p>

            <div style={{ marginBottom: "15px" }}>
              <Label htmlFor="paymentMethod">Forma de Pagamento:</Label>
              <select
                id="paymentMethod"
                value={currentPaymentMethod}
                onChange={(e) => setCurrentPaymentMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginBottom: "10px",
                }}
              >
                <option value="Cartão">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
              </select>

              <Label htmlFor="paymentAmount">Valor:</Label>
              <Input
                id="paymentAmount"
                type="number"
                placeholder="Valor"
                value={currentPaymentAmount}
                onChange={(e) => setCurrentPaymentAmount(e.target.value)}
              />

              <Button
                onClick={addPaymentMethod}
                style={{ width: "100%", marginTop: "10px" }}
              >
                Adicionar Forma de Pagamento
              </Button>
            </div>

            <div>
              <Button
                onClick={() => {
                  if (paymentMethods.length === 0) {
                    toast.warning("Adicione pelo menos uma forma de pagamento.")
                    return
                  }
                  const totalPayment = paymentMethods.reduce((sum, method) => sum + method.amount, 0)
                  const difference = Math.abs(totalPayment - subtotalComDesconto)
                  if (difference > 0.01) {
                    toast.warning(`O valor total (R$${totalPayment.toFixed(2)}) não corresponde ao valor da venda (R$${subtotalComDesconto.toFixed(2)}).`)
                    return
                  }
                  setShowSplitPaymentModal(false)
                }}
              >
                Confirmar
              </Button>
              <CancelButton
                onClick={() => {
                  setShowSplitPaymentModal(false)
                  setPaymentMethods([])
                }}
              >
                Cancelar
              </CancelButton>
            </div>
          </ModalContent>
        </ModalWrapper>
      )}

      {showSaveTransactionModal && (
        <ModalWrapper>
          <ModalContent>
            <h2>Salvar Venda</h2>
            <p>Total: R$ {subtotalComDesconto.toFixed(2)}</p>
            <p>Itens: {carrinho.length}</p>

            <div style={{ marginBottom: "15px" }}>
              <Label htmlFor="customerName">Nome do Cliente (opcional):</Label>
              <Input
                id="customerName"
                type="text"
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <Button onClick={saveTransaction}>Salvar</Button>
              <CancelButton onClick={() => setShowSaveTransactionModal(false)}>Cancelar</CancelButton>
            </div>
          </ModalContent>
        </ModalWrapper>
      )}

      {showSavedTransactionsModal && (
        <ModalWrapper>
          <ModalContent style={{ maxWidth: "600px", maxHeight: "80vh", overflow: "auto" }}>
            <h2>Vendas Salvas</h2>
            {savedTransactions.length === 0 ? (
              <p>Não há vendas salvas.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {savedTransactions.map(transaction => (
                  <div
                    key={transaction.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "5px",
                      padding: "10px",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <strong>{transaction.customerName}</strong>
                      <span>{new Date(transaction.timestamp).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                      <span>Itens: {transaction.carrinho.length}</span>
                      <span style={{ marginLeft: "15px" }}>
                        Total: R$ {
                          (transaction.carrinho.reduce((total, item) => {
                            if (item.bulk) {
                              return total + (item.productPrice * (item.peso || 0)) / 1000
                            } else {
                              return total + item.productPrice * (item.quantidade || 0)
                            }
                          }, 0) * (1 - transaction.desconto / 100)).toFixed(2)
                        }
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <Button
                        onClick={() => restoreTransaction(transaction)}
                        style={{ flex: 1 }}
                      >
                        Restaurar
                      </Button>
                      <CancelButton
                        onClick={() => deleteSavedTransaction(transaction.id)}
                        style={{ flex: 1 }}
                      >
                        Excluir
                      </CancelButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "15px" }}>
              <Button onClick={() => setShowSavedTransactionsModal(false)}>Fechar</Button>
            </div>
          </ModalContent>
        </ModalWrapper>
      )}
    </VendaContainer>
  )
}

export { CriarVenda }