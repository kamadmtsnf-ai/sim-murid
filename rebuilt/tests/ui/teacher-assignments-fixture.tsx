import {createRoot} from 'react-dom/client';
import {ManageAssignments} from '../../src/app/account/directory/manage-assignments';
createRoot(document.getElementById('root')!).render(<main id="main-content" className="p-4"><h1>Detail Guru</h1><ManageAssignments target="11111111-1111-4111-8111-111111111111"/></main>);
