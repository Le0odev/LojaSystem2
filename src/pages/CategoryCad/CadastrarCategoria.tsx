import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaEdit, FaTrashAlt } from 'react-icons/fa';
import {
  CategoriaContainer,
  Section,
  SectionTitle,
  Form,
  Label,
  Input,
  Button,
  H1,
  Card,
  CardList,
  CardItem,
  CardButton,
  CardInput,
  SearchButtonIcon,
  CategoryName,
  EditIcon,
  DeleteIcon,
 
} from './StyledCategoria';
import { useAuth } from '../Login/authContext';

interface Categoria {
  id: string;
  categoryName: string;
  categoryDescription: string;
}

const CadastrarCategoria: React.FC = () => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const response = await axios.get('http://localhost:8080/category', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setCategorias(response.data);
      } catch (error) {
        console.error('Erro ao obter categorias', error);
      }
    };

    fetchCategorias();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      categoryName: nome,
      categoryDescription: descricao,
    };

    try {
      if (editId) {
        // Atualizar categoria existente
        await axios.put(`http://localhost:8080/category/${editId}`, data, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        // Atualizar lista de categorias
        setCategorias(categorias.map(categoria => categoria.id === editId ? { ...categoria, ...data } : categoria));
        setEditId(null);
      } else {
        // Criar nova categoria
        const response = await axios.post('http://localhost:8080/category/cadastrar', data, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setCategorias([...categorias, response.data]);
      }

      // Limpar os campos após o cadastro ou atualização
      setNome('');
      setDescricao('');
    } catch (error) {
      console.error('Erro ao cadastrar ou atualizar categoria:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const searchCategorias = async (term: string) => {
    try {
      const response = await axios.get(`http://localhost:8080/category/search?categoryName=${term}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCategorias(response.data);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      setCategorias([]); // Limpa a lista em caso de erro
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const debounceSearch = setTimeout(() => {
        searchCategorias(searchTerm);
      }, 300); // Atraso de 300ms para evitar chamadas excessivas

      return () => clearTimeout(debounceSearch); // Limpar timeout se o componente desmontar ou searchTerm mudar
    } else {
      setCategorias([]); // Limpar lista se não houver termo de pesquisa
    }
  }, [searchTerm]);

  const handleEdit = (categoria: Categoria) => {
    // Lógica para edição
    setNome(categoria.categoryName);
    setDescricao(categoria.categoryDescription);
    // Armazenar o ID da categoria sendo editada
    setEditId(categoria.id);
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`http://localhost:8080/category/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCategorias(categorias.filter(categoria => categoria.id !== id));
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
    }
  };

  return (
    <>
      <H1>Gerenciamento de categorias:</H1>
      <CategoriaContainer>
        <Section className="category-section">
          <SectionTitle>{editId ? 'Atualizar Categoria' : 'Cadastrar Categoria'}</SectionTitle>
          <Form onSubmit={handleSubmit}>
            <Label htmlFor="nome">Nome da Categoria</Label>
            <Input
              type="text"
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              type="text"
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <Button type="submit">{editId ? 'Atualizar' : 'Cadastrar'}</Button>
          </Form>
        </Section>
        <Section className="search-section">
          <SectionTitle>Verificar existência da categoria</SectionTitle>
          <Form onSubmit={(e) => { e.preventDefault(); searchCategorias(searchTerm); }}>
            <Label htmlFor="search">Pesquisar categoria:</Label>
            <CardInput
              type="text"
              id="search"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <CardButton type="submit">
              <SearchButtonIcon><FaSearch /></SearchButtonIcon>
              Pesquisar
            </CardButton>
          </Form>
          <Card>
            <CardList>
              {categorias.length > 0 ? (
                categorias.map((categoria) => (
                  <CardItem key={categoria.id}>
              <div>
                <CategoryName>{categoria.categoryName}</CategoryName> - {categoria.categoryDescription}
              </div>
            
              <EditIcon onClick={() => handleEdit(categoria)} />
              <DeleteIcon onClick={() => handleDelete(categoria.id)} />
            
              </CardItem>
                ))
              ) : (
                <p>Nenhuma categoria encontrada</p>
              )}
            </CardList>
          </Card>
        </Section>
      </CategoriaContainer>
    </>
  );
};

export default CadastrarCategoria;
