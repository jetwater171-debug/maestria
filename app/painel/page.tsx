import type {Metadata} from 'next';
import BeachApp from '../beach-app';
export const metadata:Metadata={title:'Seu painel | Maestria Beach',robots:{index:false,follow:false}};
export default async function Panel({searchParams}:{searchParams:Promise<{cadastro?:string}>}){const {cadastro}=await searchParams;return <BeachApp initialSignup={cadastro==='1'}/>}
