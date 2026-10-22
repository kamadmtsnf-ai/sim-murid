import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LoginForm} from '../../src/app/login/login-form';
import Loading from '../../src/app/login/loading';
function Fixture(){const [show,setShow]=useState(true);if(new URLSearchParams(location.search).get('view')==='loading')return <Loading/>;return <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg p-4"><h1 className="mb-6 text-2xl font-semibold">Masuk ke SiM-Murid</h1>{show?<LoginForm/>:<p role="status">Formulir ditutup.</p>}<button type="button" className="mt-6 min-h-11" onClick={()=>setShow(false)}>Tutup formulir uji</button></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
