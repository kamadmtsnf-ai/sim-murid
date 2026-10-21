import {createRoot} from 'react-dom/client';
import {AddUser} from '../../src/app/account/directory/add-user';
createRoot(document.getElementById('root')!).render(<main id="main-content" className="p-4"><h1 className="mb-5 text-3xl font-semibold">Direktori pengguna</h1><AddUser/></main>);
