import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Products from './Products';
import * as useProductsModule from '../hooks/useProducts';
import * as useLikesModule from '../hooks/useLikes';

jest.mock('../hooks/useProducts');
jest.mock('../hooks/useLikes');

describe('Products component accessibility', () => {
  const mockProducts = [
    {
      id: 'prod-1',
      slug: 'prod-1',
      name: 'Glowing Toner',
      brand: 'K-Brand',
      category: 'Toner',
      skin: 'All Skin',
      price: '₩15,000',
      tag: 'Bestseller',
      emoji: '✨',
      color: '#FFF0F5',
      rating: 4.8,
      reviews: 120,
    },
  ];

  const toggleLikeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useProductsModule.useProducts.mockReturnValue({
      products: mockProducts,
      source: 'static',
      error: null,
      loading: false,
    });
    useLikesModule.useLikes.mockReturnValue({
      liked: {},
      toggleLike: toggleLikeMock,
    });
  });

  it('renders favorite button with correct initial aria-label and aria-pressed attributes', () => {
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    const likeButton = screen.getByRole('button', {
      name: 'Add Glowing Toner to favorites',
    });

    expect(likeButton).toBeInTheDocument();
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders favorite button with updated aria-label and aria-pressed when product is liked', () => {
    useLikesModule.useLikes.mockReturnValue({
      liked: { 'prod-1': true },
      toggleLike: toggleLikeMock,
    });

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    const likeButton = screen.getByRole('button', {
      name: 'Remove Glowing Toner from favorites',
    });

    expect(likeButton).toBeInTheDocument();
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggleLike on button click', () => {
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    const likeButton = screen.getByRole('button', {
      name: 'Add Glowing Toner to favorites',
    });

    fireEvent.click(likeButton);
    expect(toggleLikeMock).toHaveBeenCalledWith('prod-1');
  });
});
