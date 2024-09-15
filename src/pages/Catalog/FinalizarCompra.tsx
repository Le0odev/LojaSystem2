
  import React, { useState, useEffect, useCallback, useRef } from 'react';
  import { useCart } from './CartContext';
  import HeaderCart from '../../components/Header/HeadrCart/HeaderCart';
  import {
    CheckoutContainer,
    AddressSection,
    PaymentSection,
    SummarySection,
    CheckoutButton,
    InputField,
    PaymentOptionButton,
    TotalPrice,
    CartItemSummary,
    FreightDetails,
    SuccessModal,
    MapContainer,
    PickupInfo,
    PixContainer,
  } from './StyledCheckout'; // Adicione o estilo para o mapa
  import { useNavigate } from 'react-router-dom';
  import MapLoader from '../../components/MapApi/MapLoader'; // Importe o componente que carrega o script
  import MyMapComponent from '../../components/MapApi/MyMapComponent'; // Importe o componente do mapa
  import ClientModal from './ClientModal'; // Importe o componente do modal
import PIX from 'react-qrcode-pix';


  interface ClientInfo {
    name: string;
    phone: string;
  }

  type Region = 'Abreu e Lima' | 'Igarassu' | 'Paulista' | 'Outros';

  const getFreightByRegion = (region: Region): number => {
    const regionFreight: Record<Region, number> = {
      'Abreu e Lima': 7.0,
      'Igarassu': 12.0,
      'Paulista': 13.0,
      'Outros': 20.0,
    };
    return regionFreight[region] || 20.0; // Valor padrão para 'Outros'
  };

  const getRegionFromCep = (cep: string): Region => {
    if (cep.startsWith('535')) return 'Abreu e Lima';
    if (cep.startsWith('536')) return 'Igarassu';
    if (cep.startsWith('534')) return 'Paulista';
    return 'Outros'; // Default para regiões não mapeadas
  };

  const FinalizarCompra: React.FC = () => {
    const { cartItems, clearCart } = useCart();
    const [deliveryType, setDeliveryType] = useState<'Entrega' | 'Retirada'>('Entrega'); // Estado para tipo de entrega
    const [cep, setCep] = useState('');
    const [address, setAddress] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [rua, setRua] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [changeAmount, setChangeAmount] = useState<number | null>(null);
    const [formErrors, setFormErrors] = useState<string[]>([]);
    const [freight, setFreight] = useState<number>(0);
    const [orderSuccess, setOrderSuccess] = useState(false); // Estado para o modal de sucesso
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null); // Para o mapa
    const [showMap, setShowMap] = useState(false); // Estado para mostrar o mapa de confirmação
    const [clientInfo, setClientInfo] = useState<ClientInfo>({ name: '', phone: '' });
    const [showModal, setShowModal] = useState<boolean>(true); // Para exibir o modal
    const [fullPIX, setFullPIX] = useState("");
    const hasLoaded = useRef(false); // Track if onLoad has been executed


      // Use useCallback to avoid unnecessary re-renders
    const handleLoad = useCallback((newPIX: React.SetStateAction<string>) => {
        if (!hasLoaded.current) {
            setFullPIX(newPIX);
            hasLoaded.current = true; // Prevent further updates
        }
    }, []);


    
  // Coordenadas para a loja
  const storeCoordinates = {
    lat: -7.9055806,
    lng: -34.9002584,
    };

    const navigate = useNavigate();

    useEffect(() => {
      const savedName = localStorage.getItem('clientName');
      const savedPhone = localStorage.getItem('clientPhone');
      
      if (savedName && savedPhone) {
        setClientInfo({ name: savedName, phone: savedPhone });
      } else {
        setShowModal(true);
      }
    }, []);

    const handleSaveClientInfo = (name: string, phone: string) => {
      setClientInfo({ name, phone });
      localStorage.setItem('clientName', name);
      localStorage.setItem('clientPhone', phone);
      setShowModal(false);
    };

    const calculateSubtotal = () => {
      return cartItems.reduce((total, item) => {
        if (item.bulk) {
          const storedWeight = localStorage.getItem(`weight_${item.id}`);
          const weight = storedWeight ? parseFloat(storedWeight) : item.weight || 0;
          return total + ((item.productPrice / 1000) * weight);
        } else {
          return total + (item.productPrice * (item.quantity || 0));
        }
      }, 0);
    };

    const subtotal = calculateSubtotal();

    useEffect(() => {
      cartItems.forEach(item => {
        const storedWeight = localStorage.getItem(`weight_${item.id}`);
        if (storedWeight) {
          item.weight = parseFloat(storedWeight);
        }
      });
    }, [cartItems]);

    useEffect(() => {
      cartItems.forEach(item => {
        if (item.weight !== undefined) {
          localStorage.setItem(`weight_${item.id}`, item.weight.toString());
        }
      });
    }, [cartItems]);
    const now = new Date().toISOString();

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCep = e.target.value;
      setCep(newCep);

      if (newCep.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${newCep}/json/`);
          const data = await response.json();

          if (!data.erro) {
            setRua(data.logradouro || '');
            setBairro(data.bairro || '');
            setCidade(data.localidade || '');
            setAddress(`${data.logradouro}, ${data.bairro}, ${data.localidade}`);

            // Detectar região e calcular frete
            const region = getRegionFromCep(newCep);
            const calculatedFreight = getFreightByRegion(region);
            setFreight(calculatedFreight);

            // Buscar coordenadas
            const mapResponse = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${newCep}&key=AIzaSyDsOFyfLUkr6YfHgSC96aneAaGxhjQ6_Zk`
            );
            const mapData = await mapResponse.json();
            if (mapData.results.length > 0) {
              const location = mapData.results[0].geometry.location;
              setCoordinates({ lat: location.lat, lng: location.lng });
              setShowMap(true); // Exibir o mapa após obter coordenadas
            }
          } else {
            alert("CEP não encontrado");
            setRua('');
            setBairro('');
            setCidade('');
            setFreight(0);
            setShowMap(false); // Esconder o mapa se o CEP não for encontrado
          }
        } catch (error) {
          console.error("Erro ao buscar CEP:", error);
          setRua('');
          setBairro('');
          setCidade('');
          setFreight(0);
          setShowMap(false); // Esconder o mapa em caso de erro
        }
      } else {
        setRua('');
        setBairro('');
        setCidade('');
        setFreight(0);
        setShowMap(false); // Esconder o mapa se o CEP estiver incompleto
      }
    };

    const handlePaymentSelect = (method: string) => {
      setPaymentMethod(method);
    };

    const handleFinalizeOrder = () => {
      const errors: string[] = [];
      
      // Validação do tipo de entrega
      if (deliveryType === 'Entrega') {
        if (!cep) errors.push('CEP é obrigatório');
        if (!number) errors.push('Número é obrigatório');
      }
      
      // Validação do método de pagamento
      if (!paymentMethod) errors.push('Método de pagamento é obrigatório');
      
      // Validação específica para pagamento em dinheiro
      if (paymentMethod === 'Dinheiro' && (changeAmount === null || changeAmount < subtotal + freight)) {
        errors.push('O valor inserido para troco deve ser maior ou igual ao total.');
      }
      
      if (errors.length > 0) {
        setFormErrors(errors);
        return;
      }
    
      // Calcula o valor total
      const total = subtotal + freight;
    
      // Cria a mensagem do pedido
      const orderMessage = `Pedido:\n${cartItems.map(item => {
        const subtotalItem = item.bulk
          ? ((item.productPrice / 1000) * (item.weight || 0)).toFixed(2)
          : (item.productPrice * (item.quantity || 0)).toFixed(2);
        return `${item.productName} - Quantidade: ${item.bulk ? (item.weight || 0) + ' kg' : item.quantity} - Subtotal: R$${subtotalItem}`;
      }).join('\n\n')}\n\nEndereço: ${cidade}, ${bairro}, ${rua}, ${number}, ${complement} \n\nResumo da Compra:\nSubtotal: R$${subtotal.toFixed(2)}\nFrete: R$${freight.toFixed(2)}\n\nTotal: R$${total.toFixed(2)}\n`;
    
      // Adiciona o método de pagamento e troco, se aplicável
      const paymentDetails = paymentMethod === 'Dinheiro'
        ? `\nO cliente irá pagar: R$${changeAmount?.toFixed(2)}\nTroco: R$${(changeAmount ? changeAmount - total : 0).toFixed(2)}`
        : `\nMétodo de Pagamento: ${paymentMethod}`;
    
      const clientDetails = `\n\nNome do Cliente: ${clientInfo.name}\nTelefone: ${clientInfo.phone}`;
    
      // Adiciona o link do mapa, se as coordenadas estiverem disponíveis
      const mapLink = coordinates ? `\n\nLocalização no Mapa:\nhttps://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}` : '';
    
      // Mensagem completa
      const fullMessage = `${orderMessage}${paymentDetails}${mapLink}${clientDetails}`;
    
      // Codifica a mensagem para a URL
      const encodedMessage = encodeURIComponent(fullMessage);
      const phoneNumber = '5551999999999'; // Substitua pelo número de telefone desejado
    
      // Cria a URL do WhatsApp
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
    
      // Abre a URL do WhatsApp
      window.open(whatsappUrl, '_blank');
    
      // Limpa o carrinho e navega para a página de sucesso
      clearCart();
      setOrderSuccess(true);
    };
    
    

    const handleBackToCart = () => {
      navigate('/cart');
    };

    return (
      <>
      {showModal && <ClientModal onSave={handleSaveClientInfo} />}
        <HeaderCart
          showBackButton
          handleBack={handleBackToCart}
          handleGoToCart={handleBackToCart}
        />
        <CheckoutContainer>
        <AddressSection>
            <h2>Tipo de Entrega</h2>
            <PaymentOptionButton onClick={() => setDeliveryType('Entrega')} selected={deliveryType === 'Entrega'}>
              Entrega
            </PaymentOptionButton>
            <PaymentOptionButton onClick={() => setDeliveryType('Retirada')} selected={deliveryType === 'Retirada'}>
              Retirada
            </PaymentOptionButton>
          </AddressSection>
          {deliveryType === 'Entrega' && (
            <AddressSection>
              <InputField
                type="number"
                placeholder="CEP"
                value={cep}
                onChange={handleCepChange}
              />
              <InputField
                type="text"
                placeholder="Número"
                value={number}
                onChange={e => setNumber(e.target.value)}
              />
              <InputField
                type="text"
                placeholder="Complemento"
                value={complement}
                onChange={e => setComplement(e.target.value)}
              />
              <InputField
                type="text"
                placeholder="Rua"
                value={rua}
                onChange={e => setRua(e.target.value)}
                readOnly
              />
              <InputField
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={e => setBairro(e.target.value)}
                readOnly
              />
              <InputField
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                readOnly
              />
              {showMap && coordinates && (
              <MapContainer>
                <MapLoader>
                  <MyMapComponent coordinates={coordinates} />
                </MapLoader>
              </MapContainer>
            )}
            </AddressSection>
            
          )}
          {deliveryType === 'Retirada' && (
            <PickupInfo>
              <h2>Retirada na Loja</h2>
              <p>Endereço da loja: Avenida Jerônimo Gueiros, 299, Centro, Abreu e Lima</p>
              {storeCoordinates && (
              <MapContainer>
                <MapLoader>
                  <MyMapComponent coordinates={storeCoordinates} />
                </MapLoader>
              </MapContainer>
                )}
              </PickupInfo>
            
          )}
          <SummarySection>
      <h2>Resumo do Pedido</h2>
      {cartItems.map(item => (
        <CartItemSummary key={item.id}>
          <div className="item-details">
            <p className="item-name">{item.productName}</p>
            <p className="item-price"> Preço: {item.productPrice.toFixed(2)}
            </p>
            <p className="item-info">
              {item.bulk ? `Peso: ${(item.weight || 0)} g` : `Unidade: ${(item.quantity || 0)}`}
            </p>
            <p className="item-subtotal">
              R${item.bulk
                ? ((item.productPrice / 1000) * (item.weight || 0)).toFixed(2)
                : (item.productPrice * (item.quantity || 0)).toFixed(2)}
            </p>
          </div>
        </CartItemSummary>
            ))}
            <FreightDetails>Frete: R${freight.toFixed(2)}</FreightDetails>
            <TotalPrice>Total: R${(subtotal + freight).toFixed(2)}</TotalPrice>
          </SummarySection>
          <PaymentSection>
            <h2>Forma de Pagamento</h2>
            <PaymentOptionButton onClick={() => handlePaymentSelect('Maquineta')} selected={paymentMethod === 'Maquineta'}>
              Maquineta
            </PaymentOptionButton>
            <PaymentOptionButton onClick={() => handlePaymentSelect('Dinheiro')} selected={paymentMethod === 'Dinheiro'}>
              Dinheiro
            </PaymentOptionButton>
            <PaymentOptionButton onClick={() => handlePaymentSelect('Pix')} selected={paymentMethod === 'Pix'}>
              Pix
            </PaymentOptionButton>
          
            {paymentMethod === 'Dinheiro' && (
              <InputField
                type="number"
                placeholder="Troco para quanto?"
                value={changeAmount || ''}
                onChange={(e) => setChangeAmount(Number(e.target.value))}
                required
              />
            )}
            {paymentMethod === 'Pix' && (
            <PixContainer>
            <PIX 
                pixkey="leonardovinicius09@hotmail.com"
                merchant="Guilherme Neves"
                city="Paraíba do Sul"
                cep="25.850-000"
                code={"RQP" + now}
                amount={subtotal + freight}
                onLoad={handleLoad}
                resize={284}
                variant="fluid"
                padding={30}
                color="#357"
                bgColor="#def"
                bgRounded
                divider
            />
                <p>
                <code>{fullPIX}</code>
            </p>
            </PixContainer>
          )}
          </PaymentSection>
          <CheckoutButton onClick={handleFinalizeOrder}>
                  Finalizar Pedido
                </CheckoutButton>
        </CheckoutContainer>
        {formErrors.length > 0 && (
          <div style={{
            padding: '15px',
            backgroundColor: '#f8d7da', // Cor de fundo vermelho claro para erros
            color: '#721c24', // Cor do texto vermelho escuro
            borderRadius: '5px',
            border: '1px solid #f5c6cb', // Borda vermelha clara
            marginBottom: '20px',
            maxWidth: '400px',
            margin: '0 auto'
          }} role="alert">
            <p style={{
              margin: '0 0 10px 0',
              fontWeight: 'bold'
            }}>Por favor, corrija os seguintes erros:</p>
            <ul style={{
              padding: '0',
              listStyleType: 'none',
              margin: '0'
            }}>
              {formErrors.map((error, index) => (
                <li key={index} style={{
                  marginBottom: '5px',
                  padding: '5px 0'
                }}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {orderSuccess && (
          <SuccessModal>
            <h2>Pedido realizado com sucesso!</h2>
            <p>Obrigado por sua compra. Seu pedido foi processado com sucesso.</p>
            <button onClick={() => navigate('/sucess')}>Ir para página de sucesso</button>
          </SuccessModal>
        )}
      </>
    );
  };

  export default FinalizarCompra;







            
        