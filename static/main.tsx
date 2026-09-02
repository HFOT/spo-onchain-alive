// Static entry.
//
// The app is one client component that reads its data straight from the
// published relay-health page, so it does not need a server to render. This
// entry mounts it as a plain React app and Vite writes the result to static
// files, which is what GitHub Pages serves.
//
// The stylesheets are the same ones the server build uses; only the framework
// wrapper differs.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '../app/globals.css';
import '../app/art.css';
import '../app/spo.css';
import Home from '../app/page';

const el=document.getElementById('root');
if(!el)throw new Error('root element missing');
createRoot(el).render(<StrictMode><Home/></StrictMode>);
