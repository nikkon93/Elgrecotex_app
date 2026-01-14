import React, { useState, useEffect } from 'react';
import { db } from './firebase'; // Connects to the Cloud
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Package, Users, FileText, BarChart3, Plus, Trash2, Search, Eye, DollarSign, Download, Upload, ArrowLeft, Printer, X, Save, Image as ImageIcon, Home, Pencil, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import ImportExcelBtn from './components/ImportExcelBtn.jsx';

// --- 🔐 SECURITY SETTINGS ---
const APP_PASSWORD = "elgrecotex!2026@"; // <--- CHANGE THIS PASSWORD HERE

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

// --- 2. LOGIN SCREEN COMPONENT ---
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Elgrecotex ERP</h1>
          <p className="text-gray-500 text-sm mt-1">Authorized Personnel Only</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter access code..."
              value={input}
              onChange={(e) => {setError(false); setInput(e.target.value)}}
              autoFocus
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-sm text-center font-bold animate-pulse">
              Incorrect password. Please try again.
            </p>
          )}

          <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg">
            ACCESS SYSTEM
          </button>
        </form>
        <p className="text-center text-gray-400 text-xs mt-6">v2.0 Protected System</p>
      </div>
    </div>
  );
};

// --- 3. BUSINESS LOGIC ---
const calculateWeightedAverageCost = (mainCode, purchases = [], fabrics = []) => {
  let totalValue = 0;
  let totalMeters = 0;

  if (purchases) {
    purchases.forEach(purchase => {
      if (purchase.items) {
        purchase.items.forEach(item => {
          if (item.fabricCode === mainCode) {
            const m = parseFloat(item.meters || 0);
            const p = parseFloat(item.pricePerMeter || 0);
            totalValue += m * p;
            totalMeters += m;
          }
        });
      }
    });
  }

  if (fabrics) {
    const fabric = fabrics.find(f => f.mainCode === mainCode);
    if (fabric && fabric.rolls) {
      fabric.rolls.forEach(roll => {
        const p = parseFloat(roll.price || 0);
        const m = parseFloat(roll.originalMeters || roll.meters || 0);
        if (p > 0) { 
           totalValue += m * p;
           totalMeters += m;
        }
      });
    }
  }
  return totalMeters > 0 ? totalValue / totalMeters : 0;
};

const getSubcodeSummary = (rolls, mainCode, purchases, fabrics) => {
  const summary = {};
  if(!rolls) return [];
  const avgPrice = calculateWeightedAverageCost(mainCode, purchases, fabrics);

  rolls.forEach(roll => {
    if (!summary[roll.subCode]) summary[roll.subCode] = { meters: 0, count: 0 };
    summary[roll.subCode].meters += parseFloat(roll.meters || 0);
    summary[roll.subCode].count += 1;
  });

  return Object.entries(summary).map(([subCode, data]) => ({
    subCode,
    meters: data.meters,
    count: data.count,
    avgPrice: avgPrice
  }));
};

const calculateTotalWarehouseValue = (fabrics, purchases) => {
  let total = 0;
  fabrics.forEach(f => {
    const avgPrice = calculateWeightedAverageCost(f.mainCode, purchases, fabrics);
    if(f.rolls) {
        f.rolls.forEach(r => {
          let price = parseFloat(r.price || 0);
          if (price === 0) price = avgPrice;
          total += (parseFloat(r.meters || 0) * price);
        });
    }
  });
  return total;
};

// --- 4. SUB-COMPONENTS ---

const InvoiceViewer = ({ invoice, type, onBack }) => {
  const fmt = (val) => (parseFloat(val) || 0).toFixed(2);

  return (
    <div className="bg-gray-100 min-h-screen p-6 animate-in fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 no-print">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white px-4 py-2 rounded shadow-sm border">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-sm">
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
        </div>

        <div className="bg-white p-10 rounded-lg shadow-lg" id="invoice-print">
          <div className="flex justify-between border-b pb-8 mb-8">
            <div>
               <div className="flex items-center gap-3 mb-2">
                 <img src="/logo.png" alt="Logo" className="w-32 h-32 object-contain" />
                 <h1 className="text-2xl font-bold text-gray-900">Elgrecotex</h1>
               </div>
               <p className="text-gray-500 text-sm">Fabric B2B ERP System v2.0</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-800 uppercase">{type} INVOICE</h2>
              <p className="text-gray-600 mt-1">#{invoice.invoiceNo}</p>
              <p className="text-gray-500 text-sm">{invoice.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-8">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
              <p className="text-lg font-bold text-gray-900">{invoice.customer || invoice.supplier || invoice.company}</p>
              {invoice.vatNumber && <p className="text-sm text-gray-500 mt-1">VAT: {invoice.vatNumber}</p>}
            </div>
            <div className="text-right">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</h3>
               <span className={`px-3 py-1 rounded text-sm font-bold ${invoice.status === 'Completed' ? 'bg-green-100 text-green-800' : invoice.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                 {invoice.status || 'Processed'}
               </span>
            </div>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider border-y">
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-right py-3 px-4">Quantity</th>
                <th className="text-right py-3 px-4">Price/Unit</th>
                <th className="text-right py-3 px-4">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items && invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-4">
                    <p className="font-bold text-gray-800">{item.fabricCode || item.description}</p>
                    {(item.subCode || item.rollId) && (
                      <p className="text-xs text-gray-500">
                        {item.subCode ? `Sub: ${item.subCode}` : ''} {item.rollId ? `(Roll #${item.rollId})` : ''}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">{item.meters || 1}</td>
                  <td className="py-3 px-4 text-right text-gray-600">€{fmt(item.pricePerMeter || item.netPrice)}</td>
                  <td className="py-3 px-4 text-right font-medium">€{fmt(item.totalPrice || item.finalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-gray-600 text-sm"><span>Subtotal:</span> <span>€{fmt(invoice.subtotal || invoice.netPrice)}</span></div>
              <div className="flex justify-between text-gray-600 text-sm"><span>VAT ({invoice.vatRate}%):</span> <span>€{fmt(invoice.vatAmount)}</span></div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold text-gray-900"><span>Total:</span> <span>€{fmt(invoice.finalPrice)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- TABS (CONNECTED TO FIREBASE) ---

const Dashboard = ({ fabrics, orders, purchases, expenses, suppliers, customers, dateRangeStart, dateRangeEnd, setActiveTab }) => {
  const totalFabrics = fabrics.length;
  const totalRolls = fabrics.reduce((sum, f) => sum + (f.rolls ? f.rolls.length : 0), 0);
  const totalMeters = fabrics.reduce((sum, f) => sum + f.rolls?.reduce((rSum, r) => rSum + parseFloat(r.meters || 0), 0) || 0, 0);
  const totalStockValue = calculateTotalWarehouseValue(fabrics, purchases);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;

  const filteredPurchases = purchases.filter(p => p.date >= dateRangeStart && p.date <= dateRangeEnd);
  const filteredOrders = orders.filter(o => o.date >= dateRangeStart && o.date <= dateRangeEnd);
  const filteredExpenses = expenses.filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd);

  const netPurchases = filteredPurchases.reduce((s, p) => s + p.subtotal, 0);
  const vatPaid = filteredPurchases.reduce((s, p) => s + p.vatAmount, 0) + filteredExpenses.reduce((s, e) => s + e.vatAmount, 0);
  const totalCashOut = filteredPurchases.reduce((s, p) => s + p.finalPrice, 0) + filteredExpenses.reduce((s, e) => s + e.finalPrice, 0);
  const totalRevenue = filteredOrders.reduce((s, o) => s + o.subtotal, 0);
  const totalVATCollected = filteredOrders.reduce((s, o) => s + o.vatAmount, 0);
  const totalGrossProfit = totalRevenue - netPurchases - filteredExpenses.reduce((s, e) => s + e.netPrice, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
         <button className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"><Download size={16}/> Export All Data</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <DashboardCard title="Total Fabrics" value={totalFabrics} icon={Package} color="blue" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Total Rolls" value={totalRolls} icon={Package} color="green" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Total Meters" value={Math.round(totalMeters).toLocaleString()} icon={BarChart3} color="purple" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Stock Value" value={`€${totalStockValue.toFixed(2)}`} icon={DollarSign} color="emerald" onClick={() => setActiveTab('inventory')} />
        <DashboardCard title="Pending Orders" value={`${pendingOrders}/${orders.length}`} icon={FileText} color="orange" onClick={() => setActiveTab('salesinvoices')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-blue-500">
           <h3 className="font-bold text-gray-700 uppercase mb-6">Purchases</h3>
           <div className="space-y-4">
              <div className="flex justify-between font-medium text-gray-600"><span>Net Purchases:</span> <span>€{netPurchases.toFixed(2)}</span></div>
              <div className="flex justify-between font-medium text-gray-600"><span>VAT Paid:</span> <span>€{vatPaid.toFixed(2)}</span></div>
              <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center mt-4">
                 <span className="text-blue-800 font-bold">Total Cash Out:</span>
                 <span className="text-2xl font-bold text-blue-900">€{totalCashOut.toFixed(2)}</span>
              </div>
           </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-green-500">
           <h3 className="font-bold text-gray-700 uppercase mb-6">Sales</h3>
           <div className="space-y-4">
              <div className="flex justify-between font-medium text-gray-600"><span>Total Revenue:</span> <span>€{totalRevenue.toFixed(2)}</span></div>
              <div className="flex justify-between font-medium text-gray-600"><span>Total Cost (Purchases + Exp):</span> <span>€{(netPurchases + filteredExpenses.reduce((s, e) => s + e.netPrice, 0)).toFixed(2)}</span></div>
              <div className="flex justify-between font-medium text-gray-600"><span>Total VAT Collected:</span> <span>€{totalVATCollected.toFixed(2)}</span></div>
              <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center mt-4">
                 <span className="text-green-800 font-bold">Total Gross Profit:</span>
                 <span className="text-2xl font-bold text-green-900">€{totalGrossProfit.toFixed(2)}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const DashboardCard = ({ title, value, icon: Icon, color, onClick }) => {
  const style = { blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-green-50 border-green-200 text-green-700", purple: "bg-purple-50 border-purple-200 text-purple-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", orange: "bg-orange-50 border-orange-200 text-orange-700" };
  return (
    <div onClick={onClick} className={`${style[color]} border rounded-lg p-5 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between h-32 relative overflow-hidden`}>
      <div><p className="text-xs font-bold uppercase mb-1 opacity-80">{title}</p><p className="text-3xl font-bold">{value}</p></div>
      <div className="self-end"><Icon className="w-10 h-10 opacity-30" /></div>
    </div>
  );
};

const InventoryTab = ({ fabrics, purchases, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddFabric, setShowAddFabric] = useState(false);
  const [newFabricData, setNewFabricData] = useState({ mainCode: '', name: '', color: '', image: '' });
  const [addRollOpen, setAddRollOpen] = useState(null);
  const [newRollData, setNewRollData] = useState({ subCode: '', meters: '', location: '', price: '' });

  const filtered = fabrics.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.mainCode.includes(searchTerm));

  const handleAddFabric = async () => {
    if(newFabricData.mainCode) {
      await addDoc(collection(db, "fabrics"), { ...newFabricData, rolls: [] });
      setNewFabricData({ mainCode: '', name: '', color: '', image: '' });
      setShowAddFabric(false);
    }
  };

  const handleDeleteFabric = async (id) => {
    if(confirm("Delete this fabric?")) await deleteDoc(doc(db, "fabrics", id));
  };

  const handleAddRoll = async (fabricId) => {
    if(newRollData.subCode && newRollData.meters) {
      const fabric = fabrics.find(f => f.id === fabricId);
      const currentRolls = fabric.rolls || [];
      const updatedRolls = [...currentRolls, { ...newRollData, rollId: Date.now(), dateAdded: new Date().toISOString().split('T')[0] }];
      
      await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls });
      setAddRollOpen(null);
      setNewRollData({ subCode: '', meters: '', location: '', price: '' });
    }
  };

  const handleDeleteRoll = async (fabricId, rollId) => {
    const fabric = fabrics.find(f => f.id === fabricId);
    const updatedRolls = fabric.rolls.filter(r => r.rollId !== rollId);
    await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
           <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={16}/> Back to Dashboard</button>
           <h2 className="text-2xl font-bold text-gray-800">Fabric Inventory</h2>
           <p className="text-green-600 font-bold">Total Stock Value: €{calculateTotalWarehouseValue(fabrics, purchases).toFixed(2)}</p>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setShowAddFabric(true)} className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700 font-bold"><Plus size={16}/> Add Fabric</button>
         </div>
      </div>
      <input className="w-full border rounded-lg px-4 py-3 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      {showAddFabric && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
           <h3 className="font-bold mb-4 text-lg">Add New Fabric</h3>
           <div className="grid grid-cols-3 gap-4 mb-4">
              <input placeholder="Main Code" className="border p-3 rounded" value={newFabricData.mainCode} onChange={e => setNewFabricData({...newFabricData, mainCode: e.target.value})} />
              <input placeholder="Fabric Name" className="border p-3 rounded" value={newFabricData.name} onChange={e => setNewFabricData({...newFabricData, name: e.target.value})} />
              <input placeholder="Color" className="border p-3 rounded" value={newFabricData.color} onChange={e => setNewFabricData({...newFabricData, color: e.target.value})} />
           </div>
           <div className="flex gap-2">
              <button onClick={handleAddFabric} className="bg-blue-600 text-white px-6 py-2 rounded font-medium">Save</button>
              <button onClick={() => setShowAddFabric(false)} className="bg-gray-300 px-6 py-2 rounded">Cancel</button>
           </div>
        </div>
      )}
      <div className="space-y-6">
        {filtered.map(fabric => {
          const rolls = fabric.rolls || [];
          const summary = getSubcodeSummary(rolls, fabric.mainCode, purchases, fabrics);
          const totalMeters = rolls.reduce((s, r) => s + parseFloat(r.meters||0), 0) || 0;
          const fabricValue = rolls.reduce((s, r) => {
             let p = parseFloat(r.price || 0);
             if(p === 0) p = calculateWeightedAverageCost(fabric.mainCode, purchases, fabrics); 
             return s + (parseFloat(r.meters || 0) * p);
          }, 0) || 0;

          return (
            <div key={fabric.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
               <div className="p-4 border-b flex justify-between items-start bg-gray-50">
                  <div>
                      <h3 className="text-lg font-bold text-gray-800">Code: {fabric.mainCode} - {fabric.name}</h3>
                      <p className="text-gray-600 text-sm">Color: {fabric.color}</p>
                      <p className="text-blue-600 text-sm font-medium mt-1">Total: {totalMeters}m ({rolls.length} rolls)</p>
                      <p className="text-green-700 text-sm font-bold">Stock Value: €{fabricValue.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setAddRollOpen(fabric.id)} className="bg-green-600 text-white px-4 py-2 rounded shadow-sm text-sm font-bold flex items-center gap-1 hover:bg-green-700"><Plus size={16}/> Add Roll</button>
                      <button onClick={() => handleDeleteFabric(fabric.id)} className="bg-red-600 text-white px-4 py-2 rounded shadow-sm text-sm font-bold flex items-center gap-1 hover:bg-red-700"><Trash2 size={16}/> Delete Fabric</button>
                  </div>
               </div>
               <div className="p-4">
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex gap-4 flex-wrap">
                    <span className="text-sm font-bold text-gray-700 block w-full">Summary by Subcode:</span>
                    {summary.length > 0 ? summary.map((s, idx) => (
                      <div key={idx} className="bg-white border px-3 py-2 rounded shadow-sm text-sm">
                          <span className="font-bold text-gray-900">{s.subCode}:</span> <span className="text-blue-600 font-bold">{s.meters}m</span>
                      </div>
                    )) : <p className="text-sm text-gray-400 italic">No rolls available.</p>}
                 </div>
                 <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-900 border-b bg-white">
                         <th className="text-left py-2 font-bold">Sub Code</th>
                         <th className="text-left py-2 font-bold">Meters</th>
                         <th className="text-left py-2 font-bold">Location</th>
                         <th className="text-right py-2 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolls.map(roll => (
                          <tr key={roll.rollId} className="border-b last:border-0 hover:bg-gray-50">
                             <td className="py-3">{roll.subCode}</td>
                             <td className="py-3 font-bold">{roll.meters}m</td>
                             <td className="py-3">{roll.location}</td>
                             <td className="py-3 text-right">
                                <button onClick={() => handleDeleteRoll(fabric.id, roll.rollId)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                             </td>
                          </tr>
                        ))}
                    </tbody>
                 </table>
                 {addRollOpen === fabric.id && (
                   <div className="mt-4 bg-blue-50 p-4 rounded border border-blue-200">
                      <h4 className="font-bold text-sm mb-2 text-gray-700">Add New Physical Roll</h4>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                         <div><input className="w-full border p-2 rounded bg-white" value={newRollData.subCode} onChange={e => setNewRollData({...newRollData, subCode: e.target.value})} placeholder="Sub Code" /></div>
                         <div><input type="number" className="w-full border p-2 rounded bg-white" value={newRollData.meters} onChange={e => setNewRollData({...newRollData, meters: e.target.value})} placeholder="Meters" /></div>
                         <div><input className="w-full border p-2 rounded bg-white" value={newRollData.location} onChange={e => setNewRollData({...newRollData, location: e.target.value})} placeholder="Location" /></div>
                         <div><input type="number" className="w-full border p-2 rounded bg-white" value={newRollData.price} onChange={e => setNewRollData({...newRollData, price: e.target.value})} placeholder="Price (Optional)" /></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                         <button onClick={() => handleAddRoll(fabric.id)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold">Add Roll</button>
                         <button onClick={() => setAddRollOpen(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm">Cancel</button>
                      </div>
                   </div>
                 )}
               </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

const SalesInvoices = ({ orders, customers, fabrics, dateRangeStart, dateRangeEnd, onBack }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [newOrder, setNewOrder] = useState({ customer: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, status: 'Pending', items: [] });
  const [item, setItem] = useState({ fabricCode: '', rollId: '', meters: '', pricePerMeter: '' });
  const selectedFabric = fabrics.find(f => f.mainCode === item.fabricCode);

  if (viewInvoice) return <InvoiceViewer invoice={viewInvoice} type="Sales" onBack={() => setViewInvoice(null)} />;

  const addItem = () => {
    if (item.rollId && item.meters && item.pricePerMeter) {
      const roll = selectedFabric.rolls.find(r => r.rollId === parseInt(item.rollId));
      if (!roll) return;
      const total = parseFloat(item.meters) * parseFloat(item.pricePerMeter);
      setNewOrder({ ...newOrder, items: [...newOrder.items, { ...item, subCode: roll.subCode, totalPrice: total }] });
      setItem({ fabricCode: '', rollId: '', meters: '', pricePerMeter: '' });
    }
  };

  const deductStock = async (orderItems) => {
    for (const orderItem of orderItems) {
        const fabric = fabrics.find(f => f.mainCode === orderItem.fabricCode);
        if(fabric) {
            const updatedRolls = fabric.rolls.map(r => {
                if(r.rollId === parseInt(orderItem.rollId)) {
                    return { ...r, meters: Math.max(0, parseFloat(r.meters) - parseFloat(orderItem.meters)) };
                }
                return r;
            });
            await updateDoc(doc(db, "fabrics", fabric.id), { rolls: updatedRolls });
        }
    }
  };

  const saveOrder = async () => {
    const subtotal = newOrder.items.reduce((s, i) => s + i.totalPrice, 0);
    const vat = subtotal * (newOrder.vatRate / 100);
    const final = subtotal + vat;
    const orderToSave = { ...newOrder, subtotal, vatAmount: vat, finalPrice: final };

    if (editingId) {
       await updateDoc(doc(db, "orders", editingId), orderToSave);
    } else {
       if (newOrder.status === 'Completed') await deductStock(newOrder.items);
       await addDoc(collection(db, "orders"), orderToSave);
    }
    setShowAdd(false);
    setEditingId(null);
    setNewOrder({ customer: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, status: 'Pending', items: [] });
  };

  const updateStatus = async (id, newStatus) => {
    const order = orders.find(o => o.id === id);
    if (order.status !== 'Completed' && newStatus === 'Completed') await deductStock(order.items);
    await updateDoc(doc(db, "orders", id), { status: newStatus });
  };

  const deleteOrder = async (id) => {
      if(confirm("Delete this invoice?")) await deleteDoc(doc(db, "orders", id));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={16} /> Back to Dashboard</button>
          <h2 className="text-2xl font-bold text-gray-900">Sales Invoices</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700 font-bold"><Plus size={16} /> NEW SALES INVOICE</button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white border border-green-500 rounded-lg p-6 mb-6 shadow-lg">
          <h3 className="font-bold text-lg mb-4 text-gray-800">{editingId ? 'Edit Sales Invoice' : 'Create Sales Invoice'}</h3>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div><label className="text-sm font-semibold text-gray-700 block mb-1">Customer</label>
              <select className="w-full border p-2 rounded" value={newOrder.customer} onChange={e => setNewOrder({ ...newOrder, customer: e.target.value })}>
                <option>Select</option>
                {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1">Invoice No</label><input className="w-full border p-2 rounded" value={newOrder.invoiceNo} onChange={e => setNewOrder({ ...newOrder, invoiceNo: e.target.value })} /></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={newOrder.date} onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} /></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1">VAT %</label><input type="number" className="w-full border p-2 rounded" value={newOrder.vatRate} onChange={e => setNewOrder({ ...newOrder, vatRate: e.target.value })} /></div>
            <div><label className="text-sm font-semibold text-gray-700 block mb-1">Status</label>
              <select className="w-full border p-2 rounded" value={newOrder.status} onChange={e => setNewOrder({ ...newOrder, status: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select></div>
          </div>
          <div className="mb-6">
            <h4 className="font-bold text-sm mb-2 text-gray-700">Add Items</h4>
            <div className="flex gap-2 mb-3">
              <select className="border p-2 rounded flex-1 bg-gray-50" value={item.fabricCode} onChange={e => setItem({ ...item, fabricCode: e.target.value, rollId: '' })}>
                <option value="">Select Fabric</option>
                {fabrics.map(f => <option key={f.id} value={f.mainCode}>{f.mainCode} - {f.name}</option>)}
              </select>
              <select className="border p-2 rounded flex-1 bg-gray-50" disabled={!item.fabricCode} value={item.rollId} onChange={e => setItem({ ...item, rollId: e.target.value })}>
                <option value="">Select Roll</option>
                {selectedFabric?.rolls.map(r => <option key={r.rollId} value={r.rollId}>#{r.rollId} - {r.subCode} ({r.meters}m)</option>)}
              </select>
              <input type="number" placeholder="Meters" className="border p-2 rounded w-32 bg-gray-50" value={item.meters} onChange={e => setItem({ ...item, meters: e.target.value })} />
              <input type="number" placeholder="Price/M" className="border p-2 rounded w-32 bg-gray-50" value={item.pricePerMeter} onChange={e => setItem({ ...item, pricePerMeter: e.target.value })} />
              <button onClick={addItem} className="bg-green-600 text-white px-6 rounded font-bold hover:bg-green-700">Add Item</button>
            </div>
            {newOrder.items.length > 0 && (
              <div className="bg-white border rounded p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100"><tr><th className="text-left p-2">Item</th><th className="text-right p-2">Details</th><th className="text-right p-2">Total</th><th className="text-right p-2">Action</th></tr></thead>
                  <tbody>
                    {newOrder.items.map((i, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2">{i.fabricCode} (Roll #{i.rollId})</td>
                        <td className="p-2 text-right">{i.meters}m x €{i.pricePerMeter}</td>
                        <td className="p-2 text-right font-bold">€{i.totalPrice.toFixed(2)}</td>
                        <td className="p-2 text-right"><button onClick={() => setNewOrder({...newOrder, items: newOrder.items.filter((_, x) => x !== idx)})} className="text-red-500"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={saveOrder} className="bg-gray-400 text-white px-4 py-2 rounded font-bold hover:bg-gray-500">{editingId ? 'Update Invoice' : 'Save Invoice'}</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b font-bold text-gray-900">
            <tr><th className="text-left p-4">Invoice No</th><th className="text-left p-4">Customer</th><th className="text-left p-4">Date</th><th className="text-right p-4">Final Price</th><th className="text-center p-4">Status</th><th className="text-right p-4">Actions</th></tr>
          </thead>
          <tbody>
            {orders.filter(o => o.date >= dateRangeStart && o.date <= dateRangeEnd).map(order => (
              <tr key={order.id} className="border-t hover:bg-gray-50">
                <td className="p-4">{order.invoiceNo}</td>
                <td className="p-4 font-medium">{order.customer}</td>
                <td className="p-4">{order.date}</td>
                <td className="p-4 text-right font-bold">€{order.finalPrice.toFixed(2)}</td>
                <td className="p-4 text-center">
                  <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)} className={`px-3 py-1 rounded-full text-xs font-bold border-none cursor-pointer ${order.status === 'Completed' ? 'bg-green-100 text-green-800' : order.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    <option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-4 text-right flex justify-end gap-2">
                  <button onClick={() => setViewInvoice(order)} className="text-blue-500 hover:text-blue-700" title="View Invoice"><Eye size={18} /></button>
                  <button onClick={() => { setNewOrder(order); setEditingId(order.id); setShowAdd(true); }} className="text-blue-500 hover:text-blue-700"><Pencil size={18} /></button>
                  <button onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Purchases = ({ purchases, suppliers, fabrics, dateRangeStart, dateRangeEnd, onBack }) => {
   const [showAdd, setShowAdd] = useState(false);
   const [editingId, setEditingId] = useState(null);
   const [viewInvoice, setViewInvoice] = useState(null);
   const [newPurchase, setNewPurchase] = useState({ supplier: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, items: [] });
   const [item, setItem] = useState({ fabricCode: '', subCode: '', meters: '', pricePerMeter: '' });

   if (viewInvoice) return <InvoiceViewer invoice={viewInvoice} type="Purchase" onBack={() => setViewInvoice(null)} />;
   const addItem = () => {
      if(item.fabricCode && item.meters && item.pricePerMeter) {
         const total = parseFloat(item.meters) * parseFloat(item.pricePerMeter);
         setNewPurchase({...newPurchase, items: [...newPurchase.items, { ...item, totalPrice: total }] });
         setItem({ fabricCode: '', subCode: '', meters: '', pricePerMeter: '' });
      }
   };
   const savePurchase = async () => {
      const subtotal = newPurchase.items.reduce((s, i) => s + i.totalPrice, 0);
      const vat = subtotal * (newPurchase.vatRate / 100);
      const final = subtotal + vat;
      const purchaseData = { ...newPurchase, subtotal, vatAmount: vat, finalPrice: final };
      if(editingId) {
         await updateDoc(doc(db, "purchases", editingId), purchaseData);
      } else {
         await addDoc(collection(db, "purchases"), purchaseData);
      }
      setShowAdd(false);
      setEditingId(null);
      setNewPurchase({ supplier: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, items: [] });
   };
   const handleDelete = async (id) => {
       if(confirm("Delete this purchase?")) await deleteDoc(doc(db, "purchases", id));
   }

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <div>
               <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={16}/> Back to Dashboard</button>
               <h2 className="text-2xl font-bold text-gray-900">Purchase Invoices</h2>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setShowAdd(true)} className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700 font-bold"><Plus size={16}/> New Purchase Invoice</button>
            </div>
         </div>
         {showAdd && (
            <div className="bg-white border rounded-lg p-6 mb-6 shadow-md">
               <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Purchase' : 'Create Purchase Invoice'}</h3>
               <div className="grid grid-cols-4 gap-4 mb-6">
                  <div><label className="text-sm font-semibold text-gray-700 block mb-1">Supplier</label>
                  <select className="w-full border p-2 rounded" value={newPurchase.supplier} onChange={e => setNewPurchase({...newPurchase, supplier: e.target.value})}>
                     <option>Select</option>
                     {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select></div>
                  <div><label className="text-sm font-semibold text-gray-700 block mb-1">Invoice No</label><input className="w-full border p-2 rounded" value={newPurchase.invoiceNo} onChange={e => setNewPurchase({...newPurchase, invoiceNo: e.target.value})} /></div>
                  <div><label className="text-sm font-semibold text-gray-700 block mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})} /></div>
                  <div><label className="text-sm font-semibold text-gray-700 block mb-1">VAT %</label><input type="number" className="w-full border p-2 rounded" value={newPurchase.vatRate} onChange={e => setNewPurchase({...newPurchase, vatRate: e.target.value})} /></div>
               </div>
               <div className="mb-6">
                  <h4 className="font-bold text-sm mb-2 text-gray-700">Add Items</h4>
                  <div className="flex gap-2 mb-3">
                     <select className="border p-2 rounded flex-1" value={item.fabricCode} onChange={e => setItem({...item, fabricCode: e.target.value})}>
                        <option value="">Fabric</option>
                        {fabrics.map(f => <option key={f.id} value={f.mainCode}>{f.mainCode}</option>)}
                     </select>
                     <input className="border p-2 rounded flex-1" placeholder="Sub Code" value={item.subCode} onChange={e => setItem({...item, subCode: e.target.value})} />
                     <input type="number" className="border p-2 rounded flex-1" placeholder="Meters" value={item.meters} onChange={e => setItem({...item, meters: e.target.value})} />
                     <input type="number" className="border p-2 rounded flex-1" placeholder="Price/M" value={item.pricePerMeter} onChange={e => setItem({...item, pricePerMeter: e.target.value})} />
                     <button onClick={addItem} className="bg-green-600 text-white px-6 rounded font-bold">Add</button>
                  </div>
                  {newPurchase.items.map((i, idx) => (
                     <div key={idx} className="flex justify-between text-sm py-1 border-b">
                        <span>{i.fabricCode} {i.subCode}</span>
                        <span>{i.meters}m x €{i.pricePerMeter} = €{i.totalPrice.toFixed(2)}</span>
                        <button onClick={() => setNewPurchase({...newPurchase, items: newPurchase.items.filter((_, x) => x !== idx)})} className="text-red-500 ml-2"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
               <div className="flex gap-2">
                   <button onClick={savePurchase} className="bg-gray-400 text-white px-4 py-2 rounded font-bold">{editingId ? 'Update' : 'Save'}</button>
                   <button onClick={() => setShowAdd(false)} className="bg-gray-200 px-4 py-2 rounded font-bold">Cancel</button>
               </div>
            </div>
         )}
         <div className="bg-white border rounded-lg shadow-sm">
            <table className="w-full text-sm">
               <thead className="bg-gray-50 border-b font-bold text-gray-900">
                  <tr><th className="text-left p-4">Invoice No</th><th className="text-left p-4">Supplier</th><th className="text-left p-4">Date</th><th className="text-center p-4">Items</th><th className="text-right p-4">Subtotal</th><th className="text-right p-4">VAT</th><th className="text-right p-4">Final Price</th><th className="text-right p-4">Actions</th></tr>
               </thead>
               <tbody>
                  {purchases.filter(p => p.date >= dateRangeStart && p.date <= dateRangeEnd).map(p => (
                     <tr key={p.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">{p.invoiceNo}</td>
                        <td className="p-4">{p.supplier}</td>
                        <td className="p-4 text-gray-500">{p.date}</td>
                        <td className="p-4 text-center">{p.items.length}</td>
                        <td className="p-4 text-right">€{p.subtotal.toFixed(2)}</td>
                        <td className="p-4 text-right">€{p.vatAmount.toFixed(2)}</td>
                        <td className="p-4 text-right font-bold">€{p.finalPrice.toFixed(2)}</td>
                        <td className="p-4 text-right flex justify-end gap-2">
                           <button onClick={() => setViewInvoice(p)} className="text-blue-500 hover:text-blue-700"><Eye size={18}/></button>
                           <button onClick={() => { setNewPurchase(p); setEditingId(p.id); setShowAdd(true); }} className="text-blue-500 hover:text-blue-700"><Pencil size={18}/></button>
                           <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   )
};

const Expenses = ({ expenses, dateRangeStart, dateRangeEnd, onBack }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [newExpense, setNewExpense] = useState({ company: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], description: '', netPrice: '', vatRate: 24 });
  
  if (viewInvoice) return <InvoiceViewer invoice={viewInvoice} type="Expense" onBack={() => setViewInvoice(null)} />;
  
  const saveExpense = async () => {
    const net = parseFloat(newExpense.netPrice || 0);
    const vat = net * (newExpense.vatRate / 100);
    const expenseData = { ...newExpense, netPrice: net, vatAmount: vat, finalPrice: net + vat, items: [{ description: newExpense.description, netPrice: net, totalPrice: net + vat }] };
    if (editingId) {
      await updateDoc(doc(db, "expenses", editingId), expenseData);
    } else {
      await addDoc(collection(db, "expenses"), expenseData);
    }
    setShowAdd(false);
    setEditingId(null);
    setNewExpense({ company: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], description: '', netPrice: '', vatRate: 24 });
  };

  const handleDelete = async (id) => {
      if(confirm("Delete this expense?")) await deleteDoc(doc(db, "expenses", id));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={16} /> Back to Dashboard</button>
          <h2 className="text-2xl font-bold text-gray-900">Other Expenses</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700 font-bold"><Plus size={16} /> Add Expense Invoice</button>
        </div>
      </div>
      {showAdd && (
        <div className="bg-white border-2 border-orange-500 rounded-lg p-6 mb-6 shadow-md">
          <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Expense' : 'Create Expense Invoice'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Invoice No</label><input className="w-full border p-2 rounded" value={newExpense.invoiceNo} onChange={e => setNewExpense({ ...newExpense, invoiceNo: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Company Name</label><input className="w-full border p-2 rounded" value={newExpense.company} onChange={e => setNewExpense({ ...newExpense, company: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
          </div>
          <div className="flex gap-4 mb-4 items-end">
            <div className="flex-grow"><label className="text-xs font-bold text-gray-600 block mb-1">Description</label><input className="w-full border p-2 rounded" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} /></div>
            <div className="w-32"><label className="text-xs font-bold text-gray-600 block mb-1">Net Price €</label><input type="number" className="w-full border p-2 rounded" value={newExpense.netPrice} onChange={e => setNewExpense({ ...newExpense, netPrice: e.target.value })} /></div>
            <div className="w-20"><label className="text-xs font-bold text-gray-600 block mb-1">VAT %</label><input type="number" className="w-full border p-2 rounded" value={newExpense.vatRate} onChange={e => setNewExpense({ ...newExpense, vatRate: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveExpense} className="bg-green-600 text-white px-4 py-2 rounded font-bold">{editingId ? 'Update Expense' : 'Save Expense'}</button>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="bg-gray-200 px-4 py-2 rounded font-bold">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b font-bold text-gray-900">
            <tr><th className="text-left p-4">Invoice No</th><th className="text-left p-4">Company</th><th className="text-left p-4">Date</th><th className="text-right p-4">Net Price</th><th className="text-right p-4">VAT</th><th className="text-right p-4">Final Price</th><th className="text-right p-4">Actions</th></tr>
          </thead>
          <tbody>
            {expenses.filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd).map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="p-4">{e.invoiceNo}</td>
                <td className="p-4">{e.company}</td>
                <td className="p-4 text-gray-500">{e.date}</td>
                <td className="p-4 text-right">€{e.netPrice.toFixed(2)}</td>
                <td className="p-4 text-right">€{e.vatAmount.toFixed(2)}</td>
                <td className="p-4 text-right font-bold">€{e.finalPrice.toFixed(2)}</td>
                <td className="p-4 text-right flex justify-end gap-2">
                  <button onClick={() => setViewInvoice(e)} className="text-blue-500 hover:text-blue-700"><Eye size={18} /></button>
                  <button onClick={() => { setNewExpense(e); setEditingId(e.id); setShowAdd(true); }} className="text-blue-500 hover:text-blue-700"><Pencil size={18} /></button>
                  <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ContactList = ({ title, data, collectionName, onBack }) => {
   const [showAdd, setShowAdd] = useState(false);
   const [editingId, setEditingId] = useState(null); 
   const [newContact, setNewContact] = useState({ name: '', contact: '', email: '', phone: '', vatNumber: '', address: '', city: '', postalCode: '', iban: '' });
   
   const handleSave = async () => {
      if (editingId) {
         await updateDoc(doc(db, collectionName, editingId), newContact);
      } else {
         await addDoc(collection(db, collectionName), newContact);
      }
      setShowAdd(false);
      setEditingId(null);
      setNewContact({ name: '', contact: '', email: '', phone: '', vatNumber: '', address: '', city: '', postalCode: '', iban: '' });
   };

   const handleDelete = async (id) => {
       if(confirm("Delete this contact?")) await deleteDoc(doc(db, collectionName, id));
   }

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <div>
               <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={16}/> Back to Dashboard</button>
               <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setShowAdd(true)} className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700 font-bold"><Plus size={16}/> Add {title}</button>
            </div>
         </div>
         {showAdd && (
            <div className="bg-white border rounded-lg p-6 mb-6 shadow-md">
               <h3 className="font-bold mb-4 text-lg">{editingId ? `Edit` : `Add`}</h3>
               <div className="grid grid-cols-5 gap-4 mb-4">
                  <input className="border p-2 rounded" placeholder="Company Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="VAT Number" value={newContact.vatNumber} onChange={e => setNewContact({...newContact, vatNumber: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Contact Person" value={newContact.contact} onChange={e => setNewContact({...newContact, contact: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Address" value={newContact.address} onChange={e => setNewContact({...newContact, address: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="City" value={newContact.city} onChange={e => setNewContact({...newContact, city: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Postal Code" value={newContact.postalCode} onChange={e => setNewContact({...newContact, postalCode: e.target.value})} />
                  <input className="border p-2 rounded col-span-2" placeholder="IBAN" value={newContact.iban} onChange={e => setNewContact({...newContact, iban: e.target.value})} />
               </div>
               <div className="flex gap-2">
                   <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">{editingId ? 'Update' : 'Add'}</button>
                   <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="bg-gray-200 px-6 py-2 rounded font-bold">Cancel</button>
               </div>
            </div>
         )}
         <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
               <thead className="bg-gray-50 border-b font-bold text-gray-900">
                  <tr>
                     <th className="text-left p-4">Company</th>
                     <th className="text-left p-4">VAT</th>
                     <th className="text-left p-4">Contact</th>
                     <th className="text-left p-4">Phone</th>
                     <th className="text-left p-4">Address</th>
                     <th className="text-left p-4">IBAN</th>
                     <th className="text-right p-4">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {data.map(d => (
                     <tr key={d.id} className="border-t hover:bg-gray-50">
                        <td className="p-4 font-medium">{d.name}</td>
                        <td className="p-4 text-gray-600">{d.vatNumber || '-'}</td>
                        <td className="p-4">{d.contact}</td>
                        <td className="p-4">{d.phone}</td>
                        <td className="p-4 text-xs text-gray-500">{d.address} {d.city ? `, ${d.city}` : ''} {d.postalCode}</td>
                        <td className="p-4 font-mono text-xs">{d.iban || '-'}</td>
                        <td className="p-4 text-right flex justify-end gap-2">
                           <button onClick={() => { setNewContact(d); setEditingId(d.id); setShowAdd(true); }} className="text-blue-500 hover:text-blue-700"><Pencil size={18}/></button>
                           <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );
};

// --- 5. MAIN APP COMPONENT ---
const FabricERP = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Security Gate
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

  // REAL-TIME DATA SYNC
  useEffect(() => {
    if (!isAuthenticated) return; // Don't fetch data until logged in!

    const unsubFab = onSnapshot(collection(db, 'fabrics'), (snap) => setFabrics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubOrd = onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPur = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc')), (snap) => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSup = onSnapshot(collection(db, 'suppliers'), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubFab(); unsubOrd(); unsubPur(); unsubExp(); unsubSup(); unsubCus(); };
  }, [isAuthenticated]);

  // --- SHOW LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!isAuthenticated) {
    return <LoginScreen onLogin={setIsAuthenticated} />;
  }

  // --- SHOW MAIN APP IF AUTHENTICATED ---
  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      <div className="bg-white border-b sticky top-0 z-20 print:hidden">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="w-32 h-32 flex items-center justify-center">
                 <img src="/logo.png" alt="Elgrecotex Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                 <h1 className="text-xl font-bold text-gray-900 leading-none">Elgrecotex</h1>
                 <p className="text-xs text-gray-500 mt-1">Fabric B2B ERP System v2.0</p>
              </div>
           </div>
           
           <nav className="flex items-center gap-6">
             {['dashboard', 'inventory', 'salesinvoices', 'purchases', 'expenses', 'suppliers', 'customers'].map(tab => (
               <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 pb-1' : 'text-gray-500 hover:text-gray-900 pb-1'}`}
               >
                  {tab === 'dashboard' && <BarChart3 size={16}/>}
                  {tab === 'inventory' && <Package size={16}/>}
                  {tab === 'salesinvoices' && <FileText size={16}/>}
                  {tab === 'purchases' && <Package size={16}/>}
                  {tab === 'expenses' && <FileText size={16}/>}
                  {tab === 'suppliers' && <Users size={16}/>}
                  {tab === 'customers' && <Users size={16}/>}
                  {tab === 'salesinvoices' ? 'Sales Invoices' : tab === 'expenses' ? 'Other Expenses' : tab.charAt(0).toUpperCase() + tab.slice(1)}
               </button>
             ))}
           </nav>

           <div className="flex items-center gap-2 bg-white border px-3 py-1 rounded shadow-sm text-sm text-gray-600">
              <span className="font-medium">From:</span>
              <input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} className="border p-1 rounded" />
              <span className="font-medium">To:</span>
              <input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} className="border p-1 rounded" />
           </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8 print:p-0">
        {activeTab === 'dashboard' && <Dashboard fabrics={fabrics} orders={orders} purchases={purchases} expenses={expenses} suppliers={suppliers} customers={customers} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} setActiveTab={setActiveTab} />}
        {activeTab === 'inventory' && <InventoryTab fabrics={fabrics} purchases={purchases} onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'salesinvoices' && <SalesInvoices orders={orders} customers={customers} fabrics={fabrics} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'purchases' && <Purchases purchases={purchases} suppliers={suppliers} fabrics={fabrics} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'expenses' && <Expenses expenses={expenses} dateRangeStart={dateRangeStart} dateRangeEnd={dateRangeEnd} onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'suppliers' && <ContactList title="Suppliers" data={suppliers} collectionName="suppliers" onBack={() => setActiveTab('dashboard')} />}
        {activeTab === 'customers' && <ContactList title="Customers" data={customers} collectionName="customers" onBack={() => setActiveTab('dashboard')} />}
      </div>
    </div>
  );
};

export default FabricERP;