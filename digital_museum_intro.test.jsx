import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import DigitalMuseumIntro from './digital_museum_intro.jsx';

test('DigitalMuseumIntro bileşeni render olur', () => {
  const { container } = render(<DigitalMuseumIntro />);
  expect(container).not.toBeEmptyDOMElement();
});
