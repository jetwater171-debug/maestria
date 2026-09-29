import type {Metadata} from 'next';
import LandingPage from './landing-page';
export const metadata:Metadata={title:'Maestria Beach | Sua barraca cheia. Sua cabeça tranquila.',description:'Organize mesas, pedidos, cozinha, caixa e estoque da sua barraca de praia. Atendimento pelo celular, cardápio com IA e uma equipe conectada.',openGraph:{title:'Maestria Beach — Sua barraca, mais organizada',description:'Do primeiro pedido à conta fechada. Conheça um sistema feito para o ritmo da praia.',type:'website',locale:'pt_BR',images:[{url:'/images/maestria-praia.webp',width:1536,height:1024,alt:'Maestria Beach — gestão para barracas de praia'}]}};
export default function Home(){return <LandingPage/>}
