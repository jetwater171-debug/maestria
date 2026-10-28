import type {Metadata} from 'next';
import AdminDashboard from './admin-dashboard';
import './admin.css';
export const metadata:Metadata={title:'Administração | Maestria Beach',robots:{index:false,follow:false}};
export default function AdminPage(){return <AdminDashboard/>}
