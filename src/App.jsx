import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { 
  Package, Users, FileText, BarChart3, Plus, Trash2, Search, Eye, 
  DollarSign, Download, Upload, ArrowLeft, Printer, X, Save, 
  Image as ImageIcon, Home, Pencil, Lock, Tag, Menu, LogOut, ChevronRight, Hash
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ImportExcelBtn from './components/ImportExcelBtn.jsx';

// --- 🔐 SECURITY SETTINGS ---
const APP_PASSWORD = "elgreco!2026@"; 

// --- 1. UTILITY: EXPORT FUNCTION ---
const exportData = (data, filename, format = 'xlsx') => {
  const ws = XLSX.utils.json_to_sheet(data);
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
};

// --- UTILITY: ORDER ID GENERATOR ---
const generateOrderId = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g, ''); // 20260121
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 digit random
  return `ORD-${datePart}-${randomPart}`;
};

// --- HIGHLIGHTER COMPONENT ---
const HighlightText = ({ text, highlight }) => {
  if (!highlight || !text) return <span>{text}</span>;
  const textStr = String(text); 
  const parts = textStr.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? 
          <span key={i} className="bg-yellow-300 text-black font-bold px-0.5 rounded-sm shadow-sm">{part}</span> : part
      )}
    </span>
  );
};

// --- 2. LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      onLogin(true);
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-amber-500">
        <div className="text-center mb-8">
          <div className="w-32 h-32 mx-auto mb-4 flex items-center justify-center">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800">Elgrecotex ERP</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">Secure Workspace Access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Access Key</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-800 font-bold"
              placeholder="••••••••"
              value={input}
              onChange={(e) => {setError(false); setInput(e.target.value)}}
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center font-bold animate-pulse bg-red-50 p-2 rounded">⛔ Incorrect Access Key</p>}
          <button className="w-full bg-amber-500 text-white font-bold py-4 rounded-lg hover:bg-amber-600 transition-transform active:scale-95 shadow-lg flex justify-center items-center gap-2">
            ENTER SYSTEM <ChevronRight size={20}/>
          </button>
        </form>
        <p className="text-center text-slate-300 text-xs mt-8">v3.0 Enterprise System</p>
      </div>
    </div>
  );
};

// --- 3. BUSINESS LOGIC ---
const calculateWeightedAverageCost = (mainCode, purchases = [], fabrics = []) => {
  let totalValue = 0;
  let totalMeters = 0;
  if (purchases) purchases.forEach(p => p.items?.forEach(i => { if (i.fabricCode === mainCode) { totalValue += (parseFloat(i.meters)||0) * (parseFloat(i.pricePerMeter)||0); totalMeters += (parseFloat(i.meters)||0); }}));
  if (fabrics) { const f = fabrics.find(x => x.mainCode === mainCode); f?.rolls?.forEach(r => { const p = parseFloat(r.price||0); if(p>0){ totalValue += (parseFloat(r.meters)||0)*p; totalMeters += (parseFloat(r.meters)||0); }}); }
  return totalMeters > 0 ? totalValue / totalMeters : 0;
};
const getSubcodeSummary = (rolls, mainCode, purchases, fabrics) => {
  const summary = {};
  if(!rolls) return [];
  const avgPrice = calculateWeightedAverageCost(mainCode, purchases, fabrics);
  rolls.forEach(r => { 
      if (!summary[r.subCode]) summary[r.subCode] = { meters: 0, count: 0 }; 
      summary[r.subCode].meters += parseFloat(r.meters || 0); 
      summary[r.subCode].count += 1; 
  });
  return Object.entries(summary).map(([subCode, data]) => ({ subCode, meters: data.meters, count: data.count, avgPrice }));
};
const calculateTotalWarehouseValue = (fabrics, purchases) => {
  let total = 0;
  fabrics.forEach(f => { const avgPrice = calculateWeightedAverageCost(f.mainCode, purchases, fabrics); f.rolls?.forEach(r => { total += (parseFloat(r.meters || 0) * (parseFloat(r.price || 0) || avgPrice)); }); });
  return total;
};

// --- 4. VIEWERS ---
const InvoiceViewer = ({ invoice, type, onBack }) => {
  const fmt = (val) => (parseFloat(val) || 0).toFixed(2);
  return (
    <div className="bg-gray-100 min-h-screen p-8 animate-in fade-in flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6 flex justify-between items-center no-print">
          <button onClick={onBack} className="bg-white text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 border flex items-center gap-2"><ArrowLeft size={18}/> Back to List</button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 flex items-center gap-2"><Printer size={18}/> Print</button>
      </div>

      <div className="bg-white p-12 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200" id="invoice-print">
        <div className="flex justify-between items-start mb-12 border-b pb-8">
           <div>
             <img src="/logo.png" className="h-16 mb-4 object-contain" alt="Logo"/>
             <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Elgrecotex</h1>
             <p className="text-slate-500 font-medium mt-1">Premium Textiles</p>
           </div>
           <div className="text-right">
             <h2 className="text-3xl font-bold text-slate-800 uppercase tracking-widest">{type} INVOICE</h2>
             <p className="text-slate-500 font-mono mt-1 text-lg">#{invoice.invoiceNo}</p>
             {invoice.orderId && <p className="text-slate-400 text-xs mt-1 font-mono">Ref: {invoice.orderId}</p>}
             <p className="text-slate-500 text-sm mt-1">{invoice.date}</p>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-12 mb-12">
           <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3><p className="text-xl font-bold text-slate-800">{invoice.customer || invoice.supplier || invoice.company}</p>{invoice.vatNumber && <p className="text-sm text-slate-500 mt-1">VAT: {invoice.vatNumber}</p>}</div>
           <div className="text-right">
             {invoice.status && (
               <>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</h3>
                <span className={`px-4 py-1 rounded-full text-sm font-bold ${invoice.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{invoice.status || 'Processed'}</span>
               </>
             )}
           </div>
        </div>
        <table className="w-full mb-12">
           <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><th className="text-left py-4 px-6 rounded-l-lg">Description</th><th className="text-right py-4 px-6">Qty</th><th className="text-right py-4 px-6">Price</th><th className="text-right py-4 px-6 rounded-r-lg">Total</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
              {(invoice.items || []).map((item, idx) => (
                 <tr key={idx}>
                   <td className="py-4 px-6">
                     <p className="font-bold text-slate-700">{item.fabricCode || item.description}</p>
                     <p className="text-xs text-slate-400">{item.subCode} {item.description && item.fabricCode ? item.description : ''}</p>
                   </td>
                   <td className="py-4 px-6 text-right font-mono text-slate-600">{item.meters || 1}</td>
                   <td className="py-4 px-6 text-right font-mono text-slate-600">€{fmt(item.pricePerMeter || item.netPrice)}</td>
                   <td className="py-4 px-6 text-right font-bold text-slate-800">€{fmt(item.totalPrice || item.finalPrice)}</td>
                 </tr>
              ))}
           </tbody>
        </table>
        <div className="flex justify-end"><div className="w-72 space-y-3"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>€{fmt(invoice.subtotal || invoice.netPrice)}</span></div><div className="flex justify-between text-slate-500"><span>VAT ({invoice.vatRate}%)</span><span>€{fmt(invoice.vatAmount)}</span></div><div className="flex justify-between border-t border-slate-200 pt-4 text-2xl font-bold text-slate-900"><span>Total</span><span>€{fmt(invoice.finalPrice)}</span></div></div></div>
      </div>
    </div>
  );
};

const SampleSlipViewer = ({ sampleLog, onBack }) => {
  return (
    <div className="bg-gray-100 min-h-screen p-8 animate-in fade-in flex flex-col items-center">
      <div className="w-full max-w-3xl mb-6 flex justify-between items-center no-print">
          <button onClick={onBack} className="bg-white text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 border flex items-center gap-2"><ArrowLeft size={18}/> Back to Samples</button>
          <button onClick={() => window.print()} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-purple-700 flex items-center gap-2"><Printer size={18}/> Print</button>
      </div>

      <div className="bg-white p-12 rounded-xl shadow-2xl w-full max-w-3xl border border-gray-200" id="invoice-print">
        <div className="border-b-2 border-purple-500 pb-8 mb-8 flex justify-between items-start">
           <div>
             <img src="/logo.png" className="h-16 mb-4 object-contain" alt="Logo"/>
             <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sample Packing Slip</h1>
             <p className="text-purple-600 font-bold mt-1">Elgrecotex</p>
           </div>
           <div className="text-right"><p className="font-mono text-lg text-slate-600">{sampleLog.date}</p><p className="text-slate-400 text-sm mt-1">Sent via: {sampleLog.carrier || 'Standard Post'}</p></div>
        </div>
        <div className="mb-12 bg-purple-50 p-6 rounded-lg border border-purple-100">
           <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Prepared For</h3>
           <p className="text-2xl font-bold text-purple-900">{sampleLog.customer}</p>
           <p className="text-purple-700 italic mt-1">{sampleLog.notes}</p>
        </div>
        <table className="w-full mb-12 border-collapse">
           <thead><tr className="border-b-2 border-slate-100 text-slate-400 text-sm uppercase"><th className="text-left py-3 px-4">Fabric</th><th className="text-left py-3 px-4">Details</th><th className="text-right py-3 px-4">Length</th></tr></thead>
           <tbody className="divide-y divide-slate-50">
              {(sampleLog.items || []).map((item, idx) => (
                 <tr key={idx}><td className="py-4 px-4 font-bold text-slate-700">{item.fabricCode}</td><td className="py-4 px-4 text-slate-500">{item.description || '-'}</td><td className="py-4 px-4 text-right font-mono font-bold text-slate-800 bg-slate-50 rounded">{item.meters ? `${item.meters}m` : 'Swatch'}</td></tr>
              ))}
           </tbody>
        </table>
      </div>
    </div>
  );
};

// --- DASHBOARD ---
const Dashboard = ({ fabrics, orders, purchases, expenses, suppliers, customers, samples, dateRangeStart, dateRangeEnd, setActiveTab }) => {
  const totalFabrics = fabrics.length;
  const totalMeters = fabrics.reduce((sum, f) => sum + f.rolls?.reduce((rSum, r) => rSum + parseFloat(r.meters || 0), 0) || 0, 0);
  const totalStockValue = calculateTotalWarehouseValue(fabrics, purchases);
  const pendingOrders = (orders||[]).filter(o => o.status === 'Pending').length;

  const filteredPurchases = (purchases||[]).filter(p => p.date >= dateRangeStart && p.date <= dateRangeEnd);
  const filteredOrders = (orders||[]).filter(o => o.date >= dateRangeStart && o.date <= dateRangeEnd);
  const filteredExpenses = (expenses||[]).filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd);

  const netPurchasesFromFabrics = filteredPurchases.reduce((s, p) => s + (parseFloat(p.subtotal) || 0), 0);
  const netExpenses = filteredExpenses.reduce((s, e) => s + (parseFloat(e.netPrice) || 0), 0);
  const totalNetPurchases = netPurchasesFromFabrics + netExpenses; 
  
  const vatPaid = filteredPurchases.reduce((s, p) => s + (parseFloat(p.vatAmount) || 0), 0) + filteredExpenses.reduce((s, e) => s + (parseFloat(e.vatAmount) || 0), 0);
  const totalCashOut = filteredPurchases.reduce((s, p) => s + (parseFloat(p.finalPrice) || 0), 0) + filteredExpenses.reduce((s, e) => s + (parseFloat(e.finalPrice) || 0), 0);
  
  const totalRevenue = filteredOrders.reduce((s, o) => s + (parseFloat(o.subtotal) || 0), 0);
  const totalGrossProfit = totalRevenue - totalNetPurchases;

  const exportAllData = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      const inventoryData = fabrics.length > 0 ? fabrics.flatMap(f => (f.rolls || []).map(r => ({ 
          Supplier: f.supplier || '', 
          MainCode: f.mainCode, 
          Name: f.name, 
          SubCode: r.subCode, 
          RollID: r.rollId, 
          Description: r.description || '', 
          Meters: r.meters, 
          Location: r.location, 
          Price: r.price, 
          Image: r.image || '' 
      }))) : [];
      if(inventoryData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventoryData), 'Inventory');
      
      const salesData = orders.flatMap(o => (o.items || []).map(item => ({ 
          OrderID: o.orderId || '', // NEW EXPORT FIELD
          Date: o.date, 
          Invoice: o.invoiceNo, 
          Customer: o.customer, 
          SubCode: item.subCode, 
          Description: item.description || '', 
          Qty: item.meters, 
          Net: item.totalPrice, 
          VAT: item.totalPrice * (o.vatRate/100), 
          Total: item.totalPrice * (1 + o.vatRate/100), 
          Status: o.status 
      })));
      if(salesData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), 'Sales');
      
      const purchaseData = purchases.flatMap(p => (p.items || []).map(item => ({ Date: p.date, Supplier: p.supplier, SubCode: item.subCode, Description: item.description || '', Qty: item.meters, Net: item.totalPrice, VAT: item.totalPrice * (p.vatRate/100), Total: item.totalPrice * (1 + p.vatRate/100) })));
      if(purchaseData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseData), 'Purchases');
      
      const expenseData = expenses.flatMap(e => (e.items || []).map(item => ({ Invoice: e.invoiceNo, Company: e.company, Date: e.date, Description: item.description, Net: item.netPrice, VAT: item.totalPrice - item.netPrice, Total: item.totalPrice })));
      if(expenseData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseData), 'Expenses');
      
      const sampleData = samples.flatMap(s => (s.items || []).map(item => ({ Date: s.date, Customer: s.customer, Notes: s.notes, Fabric: item.fabricCode, Description: item.description, Length: item.meters })));
      if(sampleData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleData), 'Samples');

      const supplierData = suppliers.map(s => ({ Company: s.name, Contact: s.contact, VAT: s.vatNumber, Phone: s.phone, Email: s.email, Address: s.address, IBAN: s.iban }));
      if(supplierData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierData), 'Suppliers');
      
      const customerData = customers.map(c => ({ Company: c.name, Contact: c.contact, VAT: c.vatNumber, Phone: c.phone, Email: c.email, Address: c.address, IBAN: c.iban }));
      if(customerData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerData), 'Customers');

      XLSX.writeFile(wb, `Elgrecotex_Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert("Error exporting data: " + error.message);
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
            <p className="text-slate-500 text-sm">Financial Overview & Actions</p>
         </div>
         <button onClick={exportAllData} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2">
            <Download size={18}/> Export All Data
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Total Fabrics" value={totalFabrics} subValue={`${Math.round(totalMeters)} meters`} icon={Package} color="blue" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Stock Value" value={`€${totalStockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} subValue="Warehouse Assets" icon={DollarSign} color="emerald" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Pending Orders" value={pendingOrders} subValue="Action Required" icon={FileText} color="amber" onClick={() => setActiveTab('salesinvoices')} />
        <DashboardCard title="Gross Profit" value={`€${totalGrossProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} subValue="Selected Period" icon={BarChart3} color={totalGrossProfit >= 0 ? "purple" : "red"} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
         <div className="flex gap-4 overflow-x-auto pb-2">
            <button onClick={() => setActiveTab('salesinvoices')} className="flex items-center gap-3 px-5 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-colors border border-blue-100"><Plus size={18}/> New Sale Invoice</button>
            <button onClick={() => setActiveTab('purchases')} className="flex items-center gap-3 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"><Plus size={18}/> New Purchase</button>
            <button onClick={() => setActiveTab('samples')} className="flex items-center gap-3 px-5 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold hover:bg-purple-100 transition-colors border border-purple-100"><Tag size={18}/> Log Sample</button>
            <button onClick={() => setActiveTab('inventory')} className="flex items-center gap-3 px-5 py-3 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors border border-slate-200"><Search size={18}/> Search Stock</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><BarChart3 size={100} /></div>
           <h3 className="font-bold text-slate-500 uppercase tracking-wider mb-6">Money Out</h3>
           <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                 <span className="text-slate-600 font-medium">Fabric Purchases</span>
                 <span className="text-xl font-bold text-slate-800">€{netPurchasesFromFabrics.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                 <span className="text-slate-600 font-medium">Other Expenses</span>
                 <span className="text-xl font-bold text-slate-800">€{netExpenses.toFixed(2)}</span>
              </div>
              <div className="pt-2">
                 <span className="block text-xs font-bold text-red-400 uppercase">Total Net Purchases</span>
                 <span className="text-3xl font-extrabold text-slate-900">€{totalNetPurchases.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="bg-red-50 p-4 rounded-xl flex justify-between items-center mt-2">
                 <span className="text-red-800 font-bold">Total Cash Out (Inc. VAT):</span>
                 <span className="text-2xl font-bold text-red-900">€{totalCashOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={100} /></div>
           <h3 className="font-bold text-slate-500 uppercase tracking-wider mb-6">Money In</h3>
           <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                 <span className="text-slate-600 font-medium">Sales Revenue</span>
                 <span className="text-xl font-bold text-emerald-600">€{totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                 <span className="text-slate-600 font-medium">VAT Collected</span>
                 <span className="text-xl font-bold text-slate-400">€{filteredOrders.reduce((s, o) => s + (parseFloat(o.vatAmount) || 0), 0).toFixed(2)}</span>
              </div>
              <div className="pt-4">
                 <span className="block text-xs font-bold text-emerald-500 uppercase">Total Revenue (Excl. VAT)</span>
                 <span className="text-4xl font-extrabold text-emerald-900">€{totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const DashboardCard = ({ title, value, subValue, icon: Icon, color, onClick }) => {
  const colors = { 
    blue: "bg-blue-50 text-blue-600 border-blue-100", 
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100", 
    purple: "bg-purple-50 text-purple-600 border-purple-100", 
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100"
  };
  
  return (
    <div onClick={onClick} className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <h4 className="text-3xl font-extrabold text-slate-800">{value}</h4>
          {subValue && <p className="text-xs font-medium text-slate-400 mt-2">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

// --- INVENTORY TAB (HIGHLIGHTED + FIXED SEARCH) ---
const InventoryTab = ({ fabrics, purchases, suppliers, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddFabric, setShowAddFabric] = useState(false);
  const [newFabricData, setNewFabricData] = useState({ mainCode: '', name: '', color: '', image: '', supplier: '' });
  const [addRollOpen, setAddRollOpen] = useState(null); 
  const [editRollMode, setEditRollMode] = useState(false);
  const [currentRoll, setCurrentRoll] = useState({ rollId: '', subCode: '', description: '', meters: '', location: '', price: '', image: '' });

  // FIXED: Deep Search + Highlighter Ready
  const filtered = fabrics.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.mainCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.rolls && f.rolls.some(r => r.subCode.toLowerCase().includes(searchTerm.toLowerCase()) || (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))))
  );

  const handleAddFabric = async () => { if(newFabricData.mainCode) { await addDoc(collection(db, "fabrics"), { ...newFabricData, rolls: [] }); setNewFabricData({ mainCode: '', name: '', color: '', image: '', supplier: '' }); setShowAddFabric(false); }};
  const handleDeleteFabric = async (id) => { if(confirm("Delete this fabric?")) await deleteDoc(doc(db, "fabrics", id)); };
  
  const openAddRoll = (fabricId) => { 
      setAddRollOpen(fabricId); 
      setEditRollMode(false); 
      setCurrentRoll({ rollId: Date.now(), subCode: '', description: '', meters: '', location: '', price: '', image: '' }); 
  }
  
  const openEditRoll = (fabricId, roll) => { 
      setAddRollOpen(fabricId); 
      setEditRollMode(true); 
      setCurrentRoll(roll); 
  }
  
  const handleSaveRoll = async (fabricId) => {
    if(currentRoll.subCode && currentRoll.meters) {
      const fabric = fabrics.find(f => f.id === fabricId);
      let updatedRolls = fabric.rolls || [];
      if(editRollMode) { updatedRolls = updatedRolls.map(r => r.rollId === currentRoll.rollId ? currentRoll : r); } 
      else { updatedRolls = [...updatedRolls, { ...currentRoll, rollId: Date.now(), dateAdded: new Date().toISOString().split('T')[0] }]; }
      await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls });
      setAddRollOpen(null);
      setCurrentRoll({ rollId: '', subCode: '', description: '', meters: '', location: '', price: '', image: '' });
    }
  };
  const handleDeleteRoll = async (fabricId, rollId) => { const fabric = fabrics.find(f => f.id === fabricId); const updatedRolls = fabric.rolls.filter(r => r.rollId !== rollId); await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls }); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-4 w-full">
           <div className="bg-slate-100 p-2 rounded-lg"><Search className="text-slate-400" size={20}/></div>
           <input className="w-full bg-transparent outline-none font-medium text-slate-700" placeholder="Search fabrics by name, code, subcode or description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus/>
         </div>
         <button onClick={() => setShowAddFabric(true)} className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-600 transition-colors shadow-md whitespace-nowrap flex gap-2"><Plus size={20}/> New Fabric</button>
      </div>
      
      {showAddFabric && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-amber-200 animate-in fade-in">
           <h3 className="font-bold mb-4 text-lg text-slate-800">Add New Fabric</h3>
           <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="col-span-1">
                 <select className="border p-3 rounded-lg w-full bg-slate-50" value={newFabricData.supplier} onChange={e => setNewFabricData({...newFabricData, supplier: e.target.value})}>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                 </select>
              </div>
              <input placeholder="Main Code" className="border p-3 rounded-lg" value={newFabricData.mainCode} onChange={e => setNewFabricData({...newFabricData, mainCode: e.target.value})} />
              <input placeholder="Fabric Name" className="border p-3 rounded-lg" value={newFabricData.name} onChange={e => setNewFabricData({...newFabricData, name: e.target.value})} />
              <input placeholder="Color" className="border p-3 rounded-lg" value={newFabricData.color} onChange={e => setNewFabricData({...newFabricData, color: e.target.value})} />
           </div>
           <div className="flex gap-2"><button onClick={handleAddFabric} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Save</button><button onClick={() => setShowAddFabric(false)} className="bg-gray-200 px-6 py-2 rounded-lg font-bold text-slate-600">Cancel</button></div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map(fabric => {
          const rolls = fabric.rolls || [];
          const totalMeters = rolls.reduce((s, r) => s + parseFloat(r.meters||0), 0) || 0;
          const summary = getSubcodeSummary(rolls, fabric.mainCode, purchases, fabrics);

          return (
            <div key={fabric.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
               <div className="p-5 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">{fabric.mainCode.substring(0,2)}</div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            <HighlightText text={fabric.mainCode} highlight={searchTerm} /> - <HighlightText text={fabric.name} highlight={searchTerm} />
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">
                           {fabric.supplier && <span className="font-bold text-slate-700 mr-2">[{fabric.supplier}]</span>}
                           {fabric.color} • {rolls.length} rolls • <span className="text-blue-600">{totalMeters}m Total</span>
                        </p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => openAddRoll(fabric.id)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg font-bold hover:bg-emerald-100 border border-emerald-100 flex items-center gap-2"><Plus size={16}/> Roll</button>
                      <button onClick={() => handleDeleteFabric(fabric.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                  </div>
               </div>
               
               <div className="px-5 pt-4 flex gap-3 flex-wrap">
                  {summary.length > 0 ? summary.map((s, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-100 px-3 py-1 rounded text-xs text-blue-800 font-bold">
                          <HighlightText text={s.subCode} highlight={searchTerm} />: {s.meters}m
                      </div>
                  )) : null}
               </div>

               {rolls.length > 0 ? (
                 <div className="p-0">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold"><tr><th className="p-3 pl-6">ID</th><th className="p-3">Img</th><th className="p-3">Sub Code</th><th className="p-3">Description</th><th className="p-3">Meters</th><th className="p-3">Location</th><th className="p-3 text-right pr-6">Action</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rolls.map(roll => (
                            <tr key={roll.rollId} className="hover:bg-slate-50">
                               <td className="p-3 pl-6 font-mono text-xs text-slate-400">#{roll.rollId}</td>
                               <td className="p-3">
                                  {roll.image ? (
                                    <a href={roll.image} target="_blank" rel="noopener noreferrer" className="block w-8 h-8 rounded overflow-hidden border border-slate-200 hover:scale-110 transition-transform">
                                      <img src={roll.image} alt="Roll" className="w-full h-full object-cover" />
                                    </a>
                                  ) : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-300"><ImageIcon size={14}/></div>}
                               </td>
                               <td className="p-3 font-medium text-slate-700">
                                   <HighlightText text={roll.subCode} highlight={searchTerm} />
                               </td>
                               <td className="p-3 text-slate-500">
                                   <HighlightText text={roll.description || '-'} highlight={searchTerm} />
                               </td>
                               <td className="p-3 font-bold text-slate-800">{roll.meters}m</td>
                               <td className="p-3 text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{roll.location}</span></td>
                               <td className="p-3 text-right pr-6 flex justify-end gap-2">
                                  <button onClick={() => openEditRoll(fabric.id, roll)} className="text-blue-500 hover:text-blue-700"><Pencil size={16}/></button>
                                  <button onClick={() => handleDeleteRoll(fabric.id, roll.rollId)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                               </td>
                            </tr>
                          ))}
                      </tbody>
                   </table>
                 </div>
               ) : <div className="p-6 text-center text-slate-400 italic">No inventory rolls found. Add one above.</div>}

               {addRollOpen === fabric.id && (
                 <div className="bg-emerald-50/50 p-4 border-t border-emerald-100">
                    <div className="flex gap-2 items-end">
                       <div className="w-24"><label className="text-[10px] uppercase font-bold text-slate-400">Sub Code</label><input className="w-full border p-2 rounded-lg bg-white" value={currentRoll.subCode} onChange={e => setCurrentRoll({...currentRoll, subCode: e.target.value})} /></div>
                       <div className="w-32"><label className="text-[10px] uppercase font-bold text-slate-400">Image Link</label><input className="w-full border p-2 rounded-lg bg-white" value={currentRoll.image} onChange={e => setCurrentRoll({...currentRoll, image: e.target.value})} placeholder="https://..." /></div>
                       <div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-400">Description</label><input className="w-full border p-2 rounded-lg bg-white" value={currentRoll.description} onChange={e => setCurrentRoll({...currentRoll, description: e.target.value})} /></div>
                       <div className="w-20"><label className="text-[10px] uppercase font-bold text-slate-400">Meters</label><input type="number" className="w-full border p-2 rounded-lg bg-white" value={currentRoll.meters} onChange={e => setCurrentRoll({...currentRoll, meters: e.target.value})} /></div>
                       <div className="w-20"><label className="text-[10px] uppercase font-bold text-slate-400">Loc</label><input className="w-full border p-2 rounded-lg bg-white" value={currentRoll.location} onChange={e => setCurrentRoll({...currentRoll, location: e.target.value})} /></div>
                       <div className="w-20"><label className="text-[10px] uppercase font-bold text-slate-400">Price</label><input type="number" className="w-full border p-2 rounded-lg bg-white" value={currentRoll.price} onChange={e => setCurrentRoll({...currentRoll, price: e.target.value})} /></div>
                       <button onClick={() => handleSaveRoll(fabric.id)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold h-[42px]">Save</button>
                       <button onClick={() => setAddRollOpen(null)} className="text-slate-400 px-4 py-2 font-bold h-[42px]">X</button>
                    </div>
                 </div>
               )}
            </div>
          )
        })}
      </div>
    </div>
  );
};

// ... (Rest of components: SalesInvoices, Purchases, Expenses, ContactList, SamplesTab - UNCHANGED)
// For brevity, assuming you keep the existing components as is. 
// I am pasting the full FabricERP below to ensure `suppliers` is passed correctly.

// --- 5. MAIN APP COMPONENT ---
const FabricERP = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dateRangeStart, setDateRangeStart] = useState('2025-01-01');
  const [dateRangeEnd, setDateRangeEnd] = useState('2027-12-31');

  // FIREBASE STATES
  const [fabrics, setFabrics] = useState([]);
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubFab = onSnapshot(collection(db, 'fabrics'), (snap) => setFabrics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubOrd = onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPur = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc')), (snap) => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSup = onSnapshot(collection(db, 'suppliers'), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSamp = onSnapshot(query(collection(db, 'samples'), orderBy('createdAt', 'desc')), (snap) => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubFab(); unsubOrd(); unsubPur(); unsubExp(); unsubSup(); unsubCus(); unsubSamp(); };
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginScreen onLogin={setIsAuthenticated} />;

  const NavItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${activeTab === id ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      
      {/* SIDEBAR NAVIGATION (FIXED LEFT) */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden lg:flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-8">
           <div className="flex justify-center mx-auto mb-6">
              <img src="/logo.png" alt="Logo" className="w-28 h-28 object-contain"/>
           </div>
           <div className="text-center">
              <h1 className="font-bold text-xl tracking-tight">Elgrecotex</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Enterprise v3.0</p>
           </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
           <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-4">Main</p>
           <NavItem id="dashboard" icon={Home} label="Dashboard" />
           <NavItem id="inventory" icon={Package} label="Inventory" />
           <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-6">Finance</p>
           <NavItem id="salesinvoices" icon={FileText} label="Sales Invoices" />
           <NavItem id="purchases" icon={BarChart3} label="Purchases" />
           <NavItem id="expenses" icon={DollarSign} label="Expenses" />
           <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-6">CRM & More</p>
           <NavItem id="samples" icon={Tag} label="Samples" />
           <NavItem id="customers" icon={Users} label="Customers" />
           <NavItem id="suppliers" icon={Users} label="Suppliers" />
        </nav>
        <div className="p-4 mt-auto">
           <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"><LogOut size={20} /> Sign Out</button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOP HEADER */}
        <header className="bg-white border-b border-slate-200 h-20 px-8 flex justify-between items-center flex-shrink-0">
           <div className="lg:hidden flex items-center gap-3"><div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-white font-bold">E</div><span className="font-bold text-slate-800">Elgrecotex</span></div>
           <div className="hidden lg:block"><h2 className="text-xl font-bold text-slate-800">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2></div>
           
           <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                 <input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} className="bg-transparent text-sm font-medium px-2 py-1 outline-none text-slate-600" />
                 <span className="text-slate-400">-</span>
                 <input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} className="bg-transparent text-sm font-medium px-2 py-1 outline-none text-slate-600" />
              </div>
              <div className="h-8 w-px bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">A</div>
                 <div className="hidden md:block"><p className="text-sm font-bold text-slate-700">Admin User</p><p className="text-xs text-slate-400">Manager</p></div>
              </div>
           </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
           <div className="max-w-7xl mx-auto">
              {activeTab === 'dashboard' && <Dashboard fabrics={fabrics} orders={orders} purchases={purchases} expenses={expenses} suppliers={suppliers} customers={customers} samples={samples} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} setActiveTab={setActiveTab} />}
              {activeTab === 'inventory' && <InventoryTab fabrics={fabrics} purchases={purchases} suppliers={suppliers} onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'salesinvoices' && <SalesInvoices orders={orders} customers={customers} fabrics={fabrics} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'purchases' && <Purchases purchases={purchases} suppliers={suppliers} fabrics={fabrics} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'expenses' && <Expenses expenses={expenses} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'suppliers' && <ContactList title="Suppliers" data={suppliers} collectionName="suppliers" onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'customers' && <ContactList title="Customers" data={customers} collectionName="customers" onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'samples' && <SamplesTab samples={samples} customers={customers} fabrics={fabrics} onBack={() => setActiveTab('dashboard')} />}
           </div>
        </div>
      </main>
    </div>
  );
};

export default FabricERP;