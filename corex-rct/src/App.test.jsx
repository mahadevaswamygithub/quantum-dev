import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoadingSpinner from './components/LoadingSpinner';
import Tooltip from './components/common/Tooltip';

test('renders LoadingSpinner component correctly', () => {
  render(<LoadingSpinner />);
  expect(screen.getByText(/loading.../i)).toBeInTheDocument();
});

test('renders Tooltip and shows content on mouse enter', () => {
  render(<Tooltip content="Helpful information tooltip" />);
  const trigger = screen.getByRole('button', { name: /more information/i });
  expect(trigger).toBeInTheDocument();

  fireEvent.mouseEnter(trigger.parentElement);
  expect(screen.getByText('Helpful information tooltip')).toBeInTheDocument();

  fireEvent.mouseLeave(trigger.parentElement);
  expect(screen.queryByText('Helpful information tooltip')).not.toBeInTheDocument();
});

test('Tooltip stays open on tap/click and closes on outside tap or Escape', () => {
  render(<Tooltip content="Tap content" />);
  const trigger = screen.getByRole('button', { name: /more information/i });
  expect(trigger).toHaveAttribute('type', 'button');

  // A tap fires focus then click; the click must not hide what focus showed.
  fireEvent.focus(trigger);
  fireEvent.click(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Tap content');

  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  fireEvent.click(trigger);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
