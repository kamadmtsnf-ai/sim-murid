/** Synthetic Dashboard QA only. Never an application route or authentication provider. */
import {Component, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {WorkspaceShell} from '../../src/components/workspace-shell';
import {AccountDashboard} from '../../src/components/account-dashboard';
import AccountLoading from '../../src/app/account/loading';
import AccountError from '../../src/app/account/error';
import {navigationFor} from '../../src/config/account-navigation';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')??'normal';
const name=scenario==='long'?'Nama'.repeat(100):'Akun Pengujian Antarmuka';
const username=scenario==='long'?'username'.repeat(75):'qa-ui';
let navigation=navigationFor([],params.get('role')!=='student');
if(scenario==='empty')navigation=[{label:'Ruang kerja',items:[{href:'/account',label:'Dashboard',description:'Ringkasan akun'}]}];
if(scenario==='many')navigation=Array.from({length:12},(_,group)=>({label:'Kelompok '+group+' '+'Layanan'.repeat(30),items:Array.from({length:30},(_,item)=>({href:`/account/qa/${group}/${item}`,label:`Layanan ${item} `+'panjang'.repeat(30),description:'Fixture sintetis'}))}));
class FixtureBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main id="fixture-error">Komponen gagal dirender</main>:this.props.children;}
}
const dashboard=<AccountDashboard name={name} expiresAt={scenario==='invalid-date'?'bukan-tanggal':scenario==='blank-date'?'':'2026-10-21T17:00:00Z'}/>;
const content=scenario==='loading'?<AccountLoading/>:scenario==='error'?<AccountError error={new Error('synthetic internal detail')} reset={()=>{document.documentElement.dataset.retried='true';}}/>:dashboard;
createRoot(document.getElementById('root')!).render(<FixtureBoundary>{scenario==='missing'?dashboard:<WorkspaceShell name={name} username={username} navigation={navigation} {...(scenario==='unavailable'?{navigationUnavailable:true}:{})}>{content}</WorkspaceShell>}</FixtureBoundary>);
