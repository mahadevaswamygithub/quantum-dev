import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StaySearch from './StaySearch';
import { addDaysISO, todayISO } from './guestUtils';

vi.mock('./publicStays', () => ({
  loadPublicStays: () => Promise.resolve([
    { id: 1, name: 'Lake View Inn', address: 'MG Road, Mysuru' },
    { id: 2, name: 'Hill Top Stay', address: 'Ooty' },
  ]),
}));

const dayButton = (iso) => screen.getByRole('button', { name: new Date(`${iso}T00:00`).toDateString() });

describe('StaySearch pickers', () => {
  it('picks a date range in the calendar and a guest count, then searches', () => {
    const onSearch = vi.fn();
    render(<StaySearch onSearch={onSearch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose check-in date' }));
    const start = addDaysISO(todayISO(), 1);
    const end = addDaysISO(todayISO(), 3);
    fireEvent.click(dayButton(start));
    expect(screen.getByText('Now pick your check-out date')).toBeInTheDocument();
    fireEvent.click(dayButton(end));
    // Picking the check-out closes the calendar.
    expect(screen.queryByText(/nights? selected/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Choose number of guests' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /Search stays/ }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ checkIn: start, checkOut: end, guests: 3 }));
  });

  it('past days are disabled and clicking before check-in restarts the range', () => {
    render(<StaySearch onSearch={() => {}} checkIn={addDaysISO(todayISO(), 5)} checkOut={addDaysISO(todayISO(), 6)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose check-in date' }));
    const yesterday = addDaysISO(todayISO(), -1);
    // Yesterday is only shown when it falls in the visible month.
    const y = screen.queryByRole('button', { name: new Date(`${yesterday}T00:00`).toDateString() });
    if (y) expect(y).toBeDisabled();
    fireEvent.click(dayButton(addDaysISO(todayISO(), 5)));
    expect(screen.getByText('Now pick your check-out date')).toBeInTheDocument();
  });

  it('suggests matching properties and areas for the destination', async () => {
    render(<StaySearch onSearch={() => {}} withDestination />);
    const input = screen.getByLabelText('Destination');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'oot' } });
    expect(await screen.findByText('Hill Top Stay')).toBeInTheDocument();
    expect(screen.queryByText('Lake View Inn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Hill Top Stay'));
    expect(input).toHaveValue('Hill Top Stay');
  });

  it('pill search will not run without a destination, and shows why', () => {
    const onSearch = vi.fn();
    render(<StaySearch variant="pill" withDestination requireDestination onSearch={onSearch}
      checkIn={addDaysISO(todayISO(), 1)} checkOut={addDaysISO(todayISO(), 2)} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Search/ })[0]);
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a destination');
    const input = screen.getByLabelText('Destination');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: 'Ooty' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Search/ })[0]);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ destination: 'Ooty', checkIn: addDaysISO(todayISO(), 1) }));
  });
});
