import {createRoot} from "react-dom/client";
import {ImportUsers} from "../../src/app/account/directory/import-users";
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-6xl space-y-4 p-4"><h1>Direktori pengguna</h1><ImportUsers/></main>);
