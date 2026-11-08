import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {PushProvider} from '../../src/components/push/push-provider';
import {PushPanel} from '../../src/components/push/push-panel';
const userId=new URLSearchParams(location.search).get('owner')??'11111111-1111-4111-8111-111111111111';
createRoot(document.getElementById('root')!).render(<StrictMode><PushProvider userId={userId}><main className="mx-auto max-w-3xl space-y-4 p-4"><h1 className="text-2xl font-semibold">Notifikasi</h1><label className="block">Draf formulir lain<input aria-label="Draf formulir lain" className="input w-full" defaultValue="Draf tetap utuh"/></label><PushPanel/></main></PushProvider></StrictMode>);
