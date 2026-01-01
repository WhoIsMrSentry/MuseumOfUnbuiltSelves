import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = document.getElementById('root');
createRoot(root).render(
	<div className="app">
		<div className="scene">
			<h1>Museum of Unbuilt Selves</h1>
			<p>App scaffold is ready. The main experience will be added next.</p>
		</div>
	</div>
);
