import React from 'react';
import { createRoot } from 'react-dom/client';
import DigitalMuseumIntro from '../digital_museum_intro.jsx';
import './styles.css';

const root = document.getElementById('root');
createRoot(root).render(<DigitalMuseumIntro />);
