
import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Truck, 
  PlusCircle, 
  LogOut,
  ChevronRight,
  Search,
  MoreVertical,
  Printer,
  Download,
  Copy,
  Edit,
  Trash2,
  Plus,
  ArrowRightLeft,
  Briefcase,
  Minus
} from 'lucide-react';

// Fixed missing properties on ICONS object by adding 'Users' and 'Briefcase' keys
export const ICONS = {
  Dashboard: <LayoutDashboard size={20} />,
  Sales: <ShoppingCart size={20} />,
  Products: <Package size={20} />,
  Customers: <Users size={20} />,
  Vendors: <Briefcase size={20} />,
  Users: <Users size={20} />,
  Briefcase: <Briefcase size={20} />,
  Banking: <CreditCard size={20} />,
  Reports: <BarChart3 size={20} />,
  Settings: <Settings size={20} />,
  Courier: <Truck size={20} />,
  Plus: <Plus size={20} />,
  Minus: <Minus size={20} />,
  PlusCircle: <PlusCircle size={20} />,
  LogOut: <LogOut size={20} />,
  ChevronRight: <ChevronRight size={20} />,
  Search: <Search size={18} />,
  More: <MoreVertical size={18} />,
  Print: <Printer size={18} />,
  Download: <Download size={18} />,
  Duplicate: <Copy size={18} />,
  Edit: <Edit size={18} />,
  Delete: <Trash2 size={18} />,
  Transfer: <ArrowRightLeft size={18} />
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('BDT', '৳');
};
