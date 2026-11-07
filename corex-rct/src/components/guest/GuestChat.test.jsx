import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import GuestChat from './GuestChat';
import { bookingAPI } from '../../services/api';

vi.mock('./guestUtils', async (orig) => ({ ...(await orig()), useGuest: () => ({ user: null, isGuest: false }) }));

describe('GuestChat', () => {
  beforeEach(() => sessionStorage.clear());

  it('opens, sends a quick reply with page context and shows stays + actions', async () => {
    const ask = vi.spyOn(bookingAPI, 'askAssistant').mockResolvedValue({ data: {
      reply: 'I found 1 stay with rooms free.', source: 'assistant',
      stays: [{ id: 7, name: 'Hill Top Stay', place: 'Ooty', min_price: '3200', rating_avg: 4.6, rating_count: 3, available_rooms: 2 }],
      bookings: [], actions: [{ label: 'See all results', to: '/book/stays' }], suggestions: ['Cheapest stays'],
    } });
    render(<MemoryRouter initialEntries={['/book/5?check_in=2030-01-02&check_out=2030-01-03']}><GuestChat org={{ id: 5 }} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Chat with us' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rooms free tonight' }));

    expect(await screen.findByText('I found 1 stay with rooms free.')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Rooms free tonight',
      context: expect.objectContaining({ org_id: 5, check_in: '2030-01-02', check_out: '2030-01-03' }),
    }));
    expect(screen.getByText('Hill Top Stay').closest('a')).toHaveAttribute('href', '/book/7?check_in=2030-01-02&check_out=2030-01-03');
    expect(screen.getByRole('link', { name: /See all results/ })).toHaveAttribute('href', '/book/stays');
    expect(screen.getByRole('button', { name: 'Cheapest stays' })).toBeInTheDocument();
  });

  it('typed message, rate-limit error message, and reset', async () => {
    vi.spyOn(bookingAPI, 'askAssistant').mockRejectedValue({ response: { status: 429 } });
    render(<MemoryRouter><GuestChat /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with us' }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/sending messages quickly/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }));
    await waitFor(() => expect(screen.queryByText('hello')).not.toBeInTheDocument());
  });
});
