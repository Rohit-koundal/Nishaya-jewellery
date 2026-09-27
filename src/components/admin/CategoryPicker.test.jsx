import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CategoryPicker from './CategoryPicker';
const categories = [{ _id: 'r', name: 'Earrings' }, { _id: 'j', name: 'Jhumkas', parent: 'r' }, { _id: 's', name: 'Silver', parent: 'j' }, { _id: 'n', name: 'Necklaces' }];
function Harness({ initial = '' }) { const [value, setValue] = useState(initial); return <><CategoryPicker categories={categories} value={value} onChange={setValue} /><output data-testid="value">{value}</output></>; }
test('selects a nested category without introducing a second product reference', () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'r' } });
  fireEvent.change(screen.getByLabelText('Subcategory'), { target: { value: 'j' } });
  fireEvent.change(screen.getByLabelText('Subcategory level 2'), { target: { value: 's' } });
  expect(screen.getByTestId('value')).toHaveTextContent('s');
  expect(screen.getByText('Selected: Earrings / Jhumkas / Silver')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'n' } });
  expect(screen.getByTestId('value')).toHaveTextContent('n');
  expect(screen.queryByLabelText('Subcategory')).not.toBeInTheDocument();
});
test('loads an existing leaf and allows selecting its parent directly', () => {
  render(<Harness initial="s" />);
  expect(screen.getByLabelText('Category')).toHaveValue('r');
  expect(screen.getByLabelText('Subcategory')).toHaveValue('j');
  fireEvent.change(screen.getByLabelText('Subcategory'), { target: { value: '' } });
  expect(screen.getByTestId('value')).toHaveTextContent('r');
});
test('never silently clears an unavailable saved category', () => {
  const change = jest.fn();
  render(<CategoryPicker categories={categories} value="archived" onChange={change} />);
  expect(screen.getByLabelText('Category')).toHaveValue('archived');
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText(/saved category has not been changed/)).toBeInTheDocument();
});
