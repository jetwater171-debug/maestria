import type {Metadata} from 'next';
import PrinterCheck from './printer-check';
export const metadata:Metadata={title:'Configurar impressora | Maestria Beach',robots:{index:false,follow:false}};
export default function PrinterPage(){return <PrinterCheck/>}
