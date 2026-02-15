import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { 
  Package, Users, FileText, BarChart3, Plus, Trash2, Search, Eye, 
  DollarSign, Download, Upload, ArrowLeft, Printer, X, Save, 
  Image as ImageIcon, Home, Pencil, Lock, Tag, Menu, LogOut, ChevronRight, Hash, FileDown,
  FileSpreadsheet, Euro, TrendingUp, Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ImportExcelBtn from './components/ImportExcelBtn.jsx';


// --- 🔐 SECURITY SETTINGS ---
const APP_PASSWORD = "elgreco!2026@"; 

// --- UTILITY: EXPORT EXCEL ---
const exportData = (data, filename, format = 'xlsx') => {
  try {
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
  } catch (error) {
    console.error("Export failed:", error);
    alert("Export failed. Please check console.");
  }
};

// --- UTILITY: ORDER ID GENERATOR ---
const generateOrderId = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${datePart}-${randomPart}`;
};

// --- UTILITY: PDF DOWNLOADER (NO BROWSER PRINT) ---
const downloadPDF = (elementId, filename) => {
  if (!window.html2pdf) {
    alert("PDF Engine is loading... please wait 3 seconds and try again.");
    return;
  }

  const element = document.getElementById(elementId);
  
  // PDF Settings
  const opt = {
    margin:       10,
    filename:     `${filename}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 }, // High resolution
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Generate and Save (Bypasses "Preparing Preview")
  window.html2pdf().set(opt).from(element).save();
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
        <p className="text-center text-slate-300 text-xs mt-8">v5.11 Fixed Stock Deduction</p>
      </div>
    </div>
  );
};

// --- 3. BUSINESS LOGIC ---
const calculateWeightedAverageCost = (mainCode, purchases = [], fabrics = []) => {
  let totalValue = 0;
  let totalMeters = 0;
  if (purchases && Array.isArray(purchases)) {
      purchases.forEach(p => (p.items || []).forEach(i => { 
          if (i.fabricCode === mainCode) { 
              totalValue += (parseFloat(i.meters)||0) * (parseFloat(i.pricePerMeter)||0); 
              totalMeters += (parseFloat(i.meters)||0); 
          }
      }));
  }
  if (fabrics && Array.isArray(fabrics)) { 
      const f = fabrics.find(x => x.mainCode === mainCode); 
      (f?.rolls || []).forEach(r => { 
          const p = parseFloat(r.price||0); 
          if(p>0){ totalValue += (parseFloat(r.meters)||0)*p; totalMeters += (parseFloat(r.meters)||0); }
      }); 
  }
  return totalMeters > 0 ? totalValue / totalMeters : 0;
};

const getSubcodesSummary = (rolls) => {
  const summary = {};
  if (!rolls) return [];

  // Loop through rolls and group them
  rolls.forEach(r => {
    // If we haven't seen this subcode yet, start a new entry
    if (!summary[r.subCode]) {
        summary[r.subCode] = { meters: 0, count: 0 };
    }
    // Add the meters and count
    summary[r.subCode].meters += parseFloat(r.meters || 0);
    summary[r.subCode].count += 1;
  });

  // Convert the summary object back into a list
  return Object.entries(summary).map(([subCode, data]) => ({
    subCode,
    meters: data.meters,
    count: data.count
  }));
};

const calculateTotalWarehouseValue = (fabrics = [], purchases = []) => {
  let total = 0;
  if (!Array.isArray(fabrics)) return 0;
  fabrics.forEach(f => { 
      const avgPrice = calculateWeightedAverageCost(f.mainCode, purchases, fabrics); 
      (f.rolls || []).forEach(r => { 
          total += (parseFloat(r.meters || 0) * (parseFloat(r.price || 0) || avgPrice)); 
      }); 
  });
  return total;
};



const InvoiceViewer = ({ invoice, type, onBack }) => {
  const fmt = (val) => (parseFloat(val) || 0).toFixed(2);
  const pdfName = `${type}_Invoice_${invoice.invoiceNo || 'Draft'}`;

  return (
    <div className="bg-gray-100 min-h-screen p-8 animate-in fade-in flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6 flex justify-between items-center print:hidden">
          <button onClick={onBack} className="bg-white text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 border flex items-center gap-2"><ArrowLeft size={18}/> Back to List</button>
          
          {/* PDF DOWNLOAD BUTTON */}
          <button onClick={() => downloadPDF('printable-content', pdfName)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-red-700 flex items-center gap-2 animate-bounce">
            <FileDown size={18}/> Download PDF
          </button>
      </div>

      {/* ID 'printable-content' is what gets converted to PDF */}
      <div id="printable-content" className="bg-white p-12 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200">
        <div className="flex justify-between items-start mb-12 border-b pb-8">
            <div>
              <img src="/logo.png" className="h-20 mb-4 object-contain" alt="Logo" style={{maxHeight:'80px'}}/>
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
                 <span className={`px-4 py-1 rounded-full text-sm font-bold border ${invoice.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{invoice.status || 'Processed'}</span>
                </>
              )}
            </div>
        </div>

        {/* UPDATED TABLE WITH SEPARATE ROLL CODE COLUMN */}
        <div className="border rounded-lg overflow-hidden mb-12">
            <table className="w-full">
               <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                   <tr>
                       <th className="text-left py-4 px-4 font-bold">Fabric Code</th>
                       <th className="text-left py-4 px-4 font-bold">Roll Code</th>
                       <th className="text-left py-4 px-4 font-bold">Description</th>
                       <th className="text-center py-4 px-4 font-bold">Qty</th>
                       <th className="text-right py-4 px-4 font-bold">Price</th>
                       <th className="text-right py-4 px-4 font-bold">Total</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {(invoice.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-4 px-4 font-bold text-slate-700">{item.fabricCode}</td>
                        <td className="py-4 px-4 font-mono text-blue-600 text-xs">{item.subCode || item.rollCode || '-'}</td>
                        <td className="py-4 px-4 text-slate-500 text-sm">{item.description || item.designCol || '-'}</td>
                        <td className="py-4 px-4 text-center font-mono text-slate-600">{fmt(item.meters)}m</td>
                        <td className="py-4 px-4 text-right font-mono text-slate-600">€{fmt(item.pricePerMeter || item.price)}</td>
                        <td className="py-4 px-4 text-right font-bold text-slate-800">€{fmt(item.totalPrice)}</td>
                      </tr>
                  ))}
               </tbody>
            </table>
        </div>

        <div className="flex justify-end">
            <div className="w-72 space-y-3">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>€{fmt(invoice.subtotal)}</span></div>
                <div className="flex justify-between text-slate-500"><span>VAT ({invoice.vatRate}%)</span><span>€{fmt(invoice.vatAmount)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-4 text-2xl font-bold text-slate-900"><span>Total</span><span>€{fmt(invoice.finalPrice)}</span></div>
            </div>
        </div>
        
        <div className="mt-12 text-center text-xs text-slate-400 border-t pt-4">
            Thank you for your business.
        </div>
      </div>
    </div>
  );
};

const SampleSlipViewer = ({ sampleLog, onBack }) => {
  const pdfName = `SampleSlip_${sampleLog.customer || 'Draft'}`;

  return (
    <div className="bg-gray-100 min-h-screen p-8 animate-in fade-in flex flex-col items-center">
      <div className="w-full max-w-3xl mb-6 flex justify-between items-center print:hidden">
          <button onClick={onBack} className="bg-white text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 border flex items-center gap-2"><ArrowLeft size={18}/> Back to Samples</button>
          <button onClick={() => downloadPDF('printable-content', pdfName)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-red-700 flex items-center gap-2 animate-bounce"><FileDown size={18}/> Download PDF</button>
      </div>

      <div id="printable-content" className="bg-white p-12 rounded-xl shadow-2xl w-full max-w-3xl border border-gray-200">
        <div className="border-b-2 border-purple-500 pb-8 mb-8 flex justify-between items-start">
            <div>
              <img src="/logo.png" className="h-20 mb-4 object-contain" alt="Logo" style={{maxHeight:'80px'}}/>
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
            <thead>
              <tr className="border-b-2 border-slate-100 text-slate-400 text-sm uppercase">
                <th className="text-left py-3 px-4">Fabric</th>
                <th className="text-left py-3 px-4">Details</th>
                <th className="text-right py-3 px-4">Length</th>
                <th className="text-right py-3 px-4">Offer Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(sampleLog.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-4 px-4 font-bold text-slate-700">{(item || {}).fabricCode || '-'}</td>
                    <td className="py-4 px-4 text-slate-500">{(item || {}).description || '-'}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-800 bg-slate-50 rounded">{(item || {}).meters ? `${item.meters}m` : 'Swatch'}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-purple-700">{(item || {}).price ? `€${item.price}` : '-'}</td>
                  </tr>
              ))}
            </tbody>
        </table>
        <div className="mt-12 text-center text-xs text-slate-400 border-t pt-4">
            Sample Shipment Document
        </div>
      </div>
    </div>
  );
};

// --- HELPER: DASHBOARD CARD ---
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
        <div className={`p-3 rounded-xl ${colors[color]}`}><Icon size={24} /></div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD (v5.41: Restored Financials + Fixed Export) ---
const Dashboard = ({ fabrics = [], orders = [], purchases = [], expenses = [], samples = [], suppliers = [], customers = [], dateRangeStart, dateRangeEnd, onNavigate }) => {
  
  // 1. FILTER DATA BY DATE
  const filteredPurchases = (purchases || []).filter(p => p.date >= dateRangeStart && p.date <= dateRangeEnd);
  const filteredOrders = (orders || []).filter(o => o.date >= dateRangeStart && o.date <= dateRangeEnd);
  const filteredExpenses = (expenses || []).filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd);

  // 2. CALCULATE METRICS (RESTORED)
  const totalStockMeters = (fabrics || []).reduce((sum, f) => sum + (f.rolls || []).reduce((s, r) => s + (parseFloat(r.meters) || 0), 0), 0);
  
  const netPurchases = filteredPurchases.reduce((s, p) => s + (parseFloat(p.subtotal) || 0), 0);
  const netExpenses = filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount || e.netPrice) || 0), 0);
  const totalRevenue = filteredOrders.reduce((s, o) => s + (parseFloat(o.subtotal) || 0), 0);
  
  const vatPaid = filteredPurchases.reduce((s, p) => s + (parseFloat(p.vatAmount) || 0), 0) + filteredExpenses.reduce((s, e) => s + (parseFloat(e.vatAmount) || 0), 0);
  const vatCollected = filteredOrders.reduce((s, o) => s + (parseFloat(o.vatAmount) || 0), 0);
  
  const totalCashOut = filteredPurchases.reduce((s, p) => s + (parseFloat(p.finalPrice) || 0), 0) + filteredExpenses.reduce((s, e) => s + (parseFloat(e.finalPrice || e.amount) || 0), 0);
  const netProfit = totalRevenue - (netPurchases + netExpenses);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;

  // 3. FULL BACKUP EXPORT (v5.43: All 7 Sheets Restored)
  const handleFullExport = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // 1. INVENTORY (With Date & Locations)
      const inv = fabrics.flatMap(f => (f.rolls || []).map(r => ({ 
        "Date Added": r.dateAdded || '-',
        "Fabric Code": f.mainCode, 
        "Fabric Name": f.name, 
        "Supplier": f.supplier || '-',
        "Roll Code": r.subCode || '-', 
        "Meters": parseFloat(r.meters || 0), 
        "Width": r.width || '-', 
        "Loc": r.location || '-', 
        "Price": parseFloat(r.price || 0)
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inv), "Inventory");

      // 2. SALES
      const sal = orders.flatMap(o => (o.items || []).map(i => ({ 
        "Date": o.date, 
        "Invoice": o.invoiceNo, 
        "Customer": o.customer, 
        "Fabric": i.fabricCode, 
        "Qty": i.meters, 
        "Net Price": i.totalPrice
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sal), "Sales");

      // 3. PURCHASES
      const pur = purchases.flatMap(p => (p.items || []).map(i => ({ 
        "Date": p.date, 
        "Supplier": p.supplier, 
        "Invoice": p.invoiceNo, 
        "Fabric": i.fabricCode, 
        "Qty": i.meters, 
        "Net Price": i.totalPrice 
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pur), "Purchases");

      // 4. EXPENSES (With Smart Logic)
      const exp = (expenses || []).map(e => {
        const itemDesc = Array.isArray(e.items) ? e.items.map(i => i.description).join(", ") : "";
        const finalDesc = e.description || itemDesc || '-';
        let finalTotal = parseFloat(e.totalAmount || e.amount || 0);
        
        // Sum items if main total is zero
        if (finalTotal === 0 && Array.isArray(e.items)) {
          finalTotal = e.items.reduce((sum, item) => sum + parseFloat(item.totalPrice || item.total || 0), 0);
        }
        
        const vat = parseFloat(e.vatAmount || e.vat || 0);
        let net = parseFloat(e.netAmount || e.net || 0);
        // Calculate Net if missing
        if (net === 0 && finalTotal > 0) net = finalTotal - vat;

        return {
          "Date": e.date || '-', 
          "Company": e.entity || e.supplier || e.company || '-', 
          "Description": finalDesc, 
          "Net Value": parseFloat(net.toFixed(2)),
          "VAT": parseFloat(vat.toFixed(2)), 
          "Total": parseFloat(finalTotal.toFixed(2))
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exp), "Expenses");

      // 5. SAMPLES (Restored!)
      const sam = (samples || []).flatMap(s => (s.items || []).map(i => ({ 
        "Date": s.date, 
        "Customer": s.customer, 
        "Fabric": i.fabricCode, 
        "Description": i.description || '-',
        "Meters": i.meters || 'Swatch',
        "Notes": s.notes || '' 
      })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sam), "Samples");

      // 6. SUPPLIERS (Restored!)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers || []), "Suppliers");

      // 7. CUSTOMERS (Restored!)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers || []), "Customers");

      // Save File
      XLSX.writeFile(wb, `ElGrecoTex_Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) { 
      console.error(e);
      alert("Export failed: " + e.message); 
    }
  };
  return (
    <div className="space-y-8 animate-in fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Overview</h2>
          <p className="text-slate-500">Selected: {dateRangeStart} to {dateRangeEnd}</p>
        </div>
        <button onClick={handleFullExport} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all">
          <FileSpreadsheet size={20}/> Export Full Backup
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Stock Meters" value={`${totalStockMeters.toFixed(1)}m`} icon={Package} color="blue" onClick={() => onNavigate('inventory')}/>
        <DashboardCard title="Net Revenue" value={`€${totalRevenue.toFixed(2)}`} icon={TrendingUp} color="emerald" onClick={() => onNavigate('sales')}/>
        <DashboardCard title="Pending Orders" value={pendingOrders} icon={Hash} color="amber" onClick={() => onNavigate('sales')}/>
        <DashboardCard title="Net Profit" value={`€${netProfit.toFixed(2)}`} icon={Wallet} color={netProfit >= 0 ? "emerald" : "red"} onClick={() => onNavigate('dashboard')}/>
      </div>

      {/* DETAILED MONEY FLOW (RESTORED) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl border shadow-sm">
          <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-6">Money Out (Expenses)</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Fabric Purchases (Net)</span><span className="font-bold">€{netPurchases.toFixed(2)}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Other Expenses (Net)</span><span className="font-bold">€{netExpenses.toFixed(2)}</span></div>
            <div className="flex justify-between border-b pb-2 text-slate-400 italic"><span>VAT Paid to Suppliers</span><span>€{vatPaid.toFixed(2)}</span></div>
            <div className="pt-4 flex justify-between text-xl font-black text-red-600"><span>TOTAL CASH OUT</span><span>€{totalCashOut.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border shadow-sm">
          <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-6">Money In (Income)</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Sales Revenue (Net)</span><span className="font-bold text-emerald-600">€{totalRevenue.toFixed(2)}</span></div>
            <div className="flex justify-between border-b pb-2 text-slate-400 italic"><span>VAT Collected from Customers</span><span>€{vatCollected.toFixed(2)}</span></div>
            <div className="flex justify-between border-b pb-2"><span>VAT Balance (Payable)</span><span className={`font-bold ${vatCollected - vatPaid > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>€{(vatCollected - vatPaid).toFixed(2)}</span></div>
            <div className="pt-4 flex justify-between text-xl font-black text-slate-900"><span>GROSS TOTAL</span><span>€{(totalRevenue + vatCollected).toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BUTTONS (RESTORED) */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
         <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => onNavigate('sales')} className="p-4 border rounded-xl hover:bg-slate-50 text-left transition-colors"><div className="font-bold text-blue-600 mb-1">New Sale</div><div className="text-xs text-slate-400">Invoice & Stock</div></button>
            <button onClick={() => onNavigate('purchases')} className="p-4 border rounded-xl hover:bg-slate-50 text-left transition-colors"><div className="font-bold text-emerald-600 mb-1">New Purchase</div><div className="text-xs text-slate-400">Add Stock</div></button>
            <button onClick={() => onNavigate('inventory')} className="p-4 border rounded-xl hover:bg-slate-50 text-left transition-colors"><div className="font-bold text-indigo-600 mb-1">Stock Status</div><div className="text-xs text-slate-400">View Rolls</div></button>
            <button onClick={() => onNavigate('samples')} className="p-4 border rounded-xl hover:bg-slate-50 text-left transition-colors"><div className="font-bold text-purple-600 mb-1">Samples</div><div className="text-xs text-slate-400">Log Shipments</div></button>
         </div>
      </div>
    </div>
  );
};
// --- 5. UNKILLABLE INVENTORY (v5.30: All Fields + Auto-ID + Delete + Safety) ---

const HighlightText = ({ text, highlight }) => {
  const strText = String(text || '');
  const strHighlight = String(highlight || '').trim();
  if (!strHighlight) return <span>{strText}</span>;
  const index = strText.toLowerCase().indexOf(strHighlight.toLowerCase());
  if (index === -1) return <span>{strText}</span>;
  return (
    <span>
      {strText.substring(0, index)}
      <mark className="bg-yellow-300 text-black rounded px-0.5 font-bold">
        {strText.substring(index, index + strHighlight.length)}
      </mark>
      {strText.substring(index + strHighlight.length)}
    </span>
  );
};

// --- 5. INVENTORY TAB (v5.42: Restored Blue Roll Breakdown) ---
const InventoryTab = ({ fabrics = [], purchases = [], suppliers = [], onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddFabric, setShowAddFabric] = useState(false);
  const [editingFabric, setEditingFabric] = useState(null);
  const [addRollOpen, setAddRollOpen] = useState(null);
  const [editRollMode, setEditRollMode] = useState(false);
  
  const [newFabricData, setNewFabricData] = useState({ mainCode: '', name: '', color: '', supplier: '', salePrice: '' });
  
  const [currentRoll, setCurrentRoll] = useState({ 
    rollId: '', subCode: '', description: '', designCol: '', width: '', 
    meters: '', location: '', price: '', image: '', dateAdded: '' 
  });

  const generateRollId = () => `EG-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleAddFabric = async () => {
    if (newFabricData.mainCode && newFabricData.name) {
      try {
        await addDoc(collection(db, "fabrics"), { ...newFabricData, rolls: [], createdAt: new Date().toISOString() });
        setShowAddFabric(false);
        setNewFabricData({ mainCode: '', name: '', color: '', supplier: '', salePrice: '' });
      } catch (e) { alert("Error: " + e.message); }
    }
  };

  const handleUpdateFabric = async () => {
    try {
      if (editingFabric?.id) {
        const { id, ...data } = editingFabric;
        await updateDoc(doc(db, "fabrics", id), data);
        setEditingFabric(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveRoll = async (fabricId) => {
    try {
      if(currentRoll.subCode && currentRoll.meters) {
        const fabric = fabrics.find(f => f.id === fabricId);
        let updatedRolls = Array.isArray(fabric?.rolls) ? [...fabric.rolls] : [];
        
        const finalDate = currentRoll.dateAdded || new Date().toISOString().split('T')[0];
        const rollToSave = { 
            ...currentRoll, 
            dateAdded: finalDate,
            rollId: currentRoll.rollId || generateRollId() 
        };

        if(editRollMode) {
          updatedRolls = updatedRolls.map(r => r.rollId === currentRoll.rollId ? rollToSave : r);
        } else {
          updatedRolls.push(rollToSave);
        }
        
        await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls });
        setAddRollOpen(null);
        setEditRollMode(false);
        setCurrentRoll({ rollId: '', subCode: '', description: '', designCol: '', width: '', meters: '', location: '', price: '', image: '', dateAdded: '' });
      }
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleDeleteRoll = async (fabricId, rollId) => { 
    if(!window.confirm("Delete this roll permanently?")) return;
    try {
      const fabric = fabrics.find(f => f.id === fabricId);
      const updatedRolls = (fabric.rolls || []).filter(r => r.rollId !== rollId); 
      await updateDoc(doc(db, "fabrics", fabricId), { rolls: updatedRolls }); 
    } catch (e) { alert(e.message); }
  };

  const filtered = (fabrics || []).filter(f => {
    try {
      const s = String(searchTerm || '').toLowerCase().trim();
      if (!s) return true;
      const mainMatch = String(f?.mainCode || '').toLowerCase().includes(s) || String(f?.name || '').toLowerCase().includes(s);
      const rollMatch = (f?.rolls || []).some(r => 
        String(r?.subCode || '').toLowerCase().includes(s) || String(r?.rollId || '').toLowerCase().includes(s) || String(r?.location || '').toLowerCase().includes(s)
      );
      return mainMatch || rollMatch;
    } catch (e) { return false; }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full">
            <Search className="text-slate-400" size={20}/>
            <input className="w-full bg-transparent outline-none font-medium text-slate-700" placeholder="Search by Code, ID, Loc..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowAddFabric(true)} className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold shadow-md">New Fabric</button>
      </div>

      {showAddFabric && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Add Fabric</h3>
                <div className="space-y-3">
                    <input className="w-full p-3 border rounded-xl" placeholder="Main Code" value={newFabricData.mainCode} onChange={e => setNewFabricData({...newFabricData, mainCode: e.target.value})} />
                    <input className="w-full p-3 border rounded-xl" placeholder="Name" value={newFabricData.name} onChange={e => setNewFabricData({...newFabricData, name: e.target.value})} />
                    <input className="w-full p-3 border rounded-xl" placeholder="Color" value={newFabricData.color} onChange={e => setNewFabricData({...newFabricData, color: e.target.value})} />
                    <select className="w-full p-3 border rounded-xl bg-white" value={newFabricData.supplier} onChange={e => setNewFabricData({...newFabricData, supplier: e.target.value})}>
                        <option value="">-- Select Supplier --</option>
                        {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <input className="w-full p-3 border rounded-xl" type="number" placeholder="Sale Price" value={newFabricData.salePrice} onChange={e => setNewFabricData({...newFabricData, salePrice: e.target.value})} />
                    <div className="flex gap-2"><button onClick={handleAddFabric} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold">Save</button><button onClick={() => setShowAddFabric(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancel</button></div>
                </div>
            </div>
        </div>
      )}

      {editingFabric && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Edit Fabric</h3>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <input className="w-full p-3 border rounded-xl font-bold" placeholder="Main Code" value={editingFabric.mainCode || ''} onChange={e => setEditingFabric({...editingFabric, mainCode: e.target.value})} />
                        <select className="w-full p-3 border rounded-xl bg-white" value={editingFabric.supplier || ''} onChange={e => setEditingFabric({...editingFabric, supplier: e.target.value})}>
                            <option value="">-- Supplier --</option>
                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <input className="w-full p-3 border rounded-xl" placeholder="Fabric Name" value={editingFabric.name || ''} onChange={e => setEditingFabric({...editingFabric, name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        <input className="w-full p-3 border rounded-xl" placeholder="Color" value={editingFabric.color || ''} onChange={e => setEditingFabric({...editingFabric, color: e.target.value})} />
                        <input className="w-full p-3 border rounded-xl" type="number" placeholder="Price" value={editingFabric.salePrice || ''} onChange={e => setEditingFabric({...editingFabric, salePrice: e.target.value})} />
                    </div>
                    <div className="flex gap-2 mt-4"><button onClick={handleUpdateFabric} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Update Fabric</button><button onClick={() => setEditingFabric(null)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancel</button></div>
                </div>
            </div>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(fabric => {
          const rawRolls = Array.isArray(fabric?.rolls) ? fabric.rolls : [];
          const rolls = rawRolls.filter(r => r && typeof r === 'object');
          const totalMeters = rolls.reduce((s, r) => s + (parseFloat(r?.meters) || 0), 0);

          // --- LOGIC RESTORED: GROUP ROLLS BY SUBCODE ---
          const rollSummary = rolls.reduce((acc, r) => {
             const code = r.subCode || 'No Code';
             acc[code] = (acc[code] || 0) + (parseFloat(r.meters) || 0);
             return acc;
          }, {});
          const breakdownString = Object.entries(rollSummary)
             .map(([code, meters]) => `${code} ${meters.toFixed(2)}m`)
             .join(', ');

          return (
            <div key={fabric?.id || Math.random()} className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-50 flex justify-between items-center border-b">
                <div>
                  <h3 className="font-bold text-lg text-slate-800"><HighlightText text={fabric?.mainCode} highlight={searchTerm}/> - {fabric?.name}</h3>
                  <p className="text-sm text-slate-500">{totalMeters.toFixed(2)}m Total • {rolls.length} rolls • <span className="text-blue-500 font-bold">{fabric.supplier}</span></p>
                  
                  {/* --- VISUAL RESTORED: BLUE BOLD ROLL BREAKDOWN --- */}
                  {breakdownString && (
                    <p className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-wide">{breakdownString}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingFabric(fabric)} className="p-2 text-slate-400 hover:text-blue-600"><Pencil size={20}/></button>
                  <button onClick={() => {setAddRollOpen(fabric.id); setEditRollMode(false); setCurrentRoll({ rollId: '', subCode: '', description: '', designCol: '', width: '', meters: '', location: '', price: '', image: '', dateAdded: new Date().toISOString().split('T')[0] });}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm">+ Roll</button>
                </div>
              </div>

              {addRollOpen === fabric.id && (
                <div className="p-6 bg-amber-50 border-b space-y-4 animate-in slide-in-from-top">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Roll ID</label><input className="w-full p-3 border-2 rounded-xl bg-slate-100 font-mono text-slate-400 text-xs" value={currentRoll.rollId || '(Auto)'} readOnly /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" className="w-full p-3 border-2 rounded-xl bg-white font-bold" value={currentRoll.dateAdded} onChange={e => setCurrentRoll({...currentRoll, dateAdded: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Roll Code</label><input className="w-full p-3 border-2 rounded-xl bg-white font-bold" value={currentRoll.subCode || ''} onChange={e => setCurrentRoll({...currentRoll, subCode: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Meters</label><input type="number" className="w-full p-3 border-2 rounded-xl bg-white font-bold" value={currentRoll.meters || ''} onChange={e => setCurrentRoll({...currentRoll, meters: e.target.value})} /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Loc</label><input className="w-full p-3 border-2 rounded-xl bg-white" value={currentRoll.location || ''} onChange={e => setCurrentRoll({...currentRoll, location: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div><label className="text-[10px] font-bold text-slate-400 uppercase">Width</label><input className="w-full p-3 border-2 rounded-xl bg-white" value={currentRoll.width || ''} onChange={e => setCurrentRoll({...currentRoll, width: e.target.value})} /></div>
                     <div><label className="text-[10px] font-bold text-slate-400 uppercase">Design</label><input className="w-full p-3 border-2 rounded-xl bg-white" value={currentRoll.designCol || ''} onChange={e => setCurrentRoll({...currentRoll, designCol: e.target.value})} /></div>
                     <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Image URL</label><input className="w-full p-3 border-2 rounded-xl bg-white text-xs" value={currentRoll.image || ''} onChange={e => setCurrentRoll({...currentRoll, image: e.target.value})} placeholder="https://..." /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveRoll(fabric.id)} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Save Roll</button>
                    <button onClick={() => setAddRollOpen(null)} className="bg-white border-2 px-8 py-3 rounded-xl font-bold text-slate-400">Cancel</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 pl-6 text-left">Date</th>
                      <th className="p-3 text-left">Auto ID</th>
                      <th className="p-3 text-left">Code</th>
                      <th className="p-3 text-left">Loc</th>
                      <th className="p-3 text-left">Meters</th>
                      <th className="p-3 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rolls.map((roll, idx) => (
                      <tr key={roll?.rollId || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 pl-6 text-slate-500 text-xs">{roll?.dateAdded || '-'}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-400">{String(roll?.rollId || 'NO ID')}</td>
                        <td className="p-3 font-bold text-blue-600"><HighlightText text={roll?.subCode} highlight={searchTerm}/></td>
                        <td className="p-3 text-slate-500 font-bold">{String(roll?.location || '-')}</td>
                        <td className="p-3 font-bold text-slate-800">{(parseFloat(roll?.meters) || 0).toFixed(2)}m</td>
                        <td className="p-3 text-right pr-6 flex justify-end gap-3">
                          <button onClick={() => {setCurrentRoll(roll); setAddRollOpen(fabric.id); setEditRollMode(true);}} className="text-blue-400 hover:text-blue-600"><Pencil size={16}/></button>
                          <button onClick={() => handleDeleteRoll(fabric.id, roll.rollId)} className="text-red-200 hover:text-red-600"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
// --- HELPER COMPONENT: SEARCHABLE DROPDOWN ---
const SearchableSelect = ({ options = [], value, onChange, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch(''); // Reset search if clicked away
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));
  const displayValue = isOpen ? search : (selected ? selected.label : '');

  const filtered = options.filter(o => 
    String(o.label).toLowerCase().includes(search.toLowerCase()) || 
    String(o.value).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input 
          type="text" 
          className={`w-full border p-3 rounded-lg outline-none transition-all pr-10 ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 border-slate-300 shadow-sm'}`}
          placeholder={placeholder}
          value={displayValue}
          disabled={disabled}
          onChange={e => {
            setSearch(e.target.value);
            setIsOpen(true);
            if (value) onChange(''); // Clear actual value when typing a new search
          }}
          onClick={() => { if(!disabled) setIsOpen(true); }}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(o => (
            <div 
              key={o.value} 
              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 text-sm text-slate-700 transition-colors"
              onClick={() => { 
                onChange(o.value); 
                setIsOpen(false); 
                setSearch(''); 
              }}
            >
              {o.label}
            </div>
          )) : (
            <div className="p-3 text-sm text-slate-400 italic">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

// --- UPDATED SALES INVOICES (v5.46: Searchable Combo Boxes) ---
const SalesInvoices = ({ orders = [], customers = [], fabrics = [], dateRangeStart, dateRangeEnd, onBack }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [newOrder, setNewOrder] = useState({ customer: '', invoiceNo: '', orderId: '', date: new Date().toISOString().split('T')[0], vatRate: 24, status: 'Pending', items: [] });
  
  const [item, setItem] = useState({ fabricCode: '', rollId: '', meters: '', pricePerMeter: '' });
  
  // Helper to find the currently selected fabric to show its rolls
  const selectedFabric = fabrics.find(f => String(f.mainCode) === String(item.fabricCode));

  if (viewInvoice) return <InvoiceViewer invoice={viewInvoice} type="Sales" onBack={() => setViewInvoice(null)} />;

  const handleNewInvoice = () => { 
      setNewOrder({ 
          customer: '', 
          invoiceNo: '', 
          orderId: generateOrderId(), 
          date: new Date().toISOString().split('T')[0], 
          vatRate: 24, 
          status: 'Pending', 
          items: [] 
      }); 
      setEditingId(null); 
      setShowAdd(true); 
  };

  const addItem = () => { 
    if (item.rollId && item.meters && item.pricePerMeter) { 
        const roll = selectedFabric?.rolls?.find(r => String(r.rollId) === String(item.rollId)); 
        if (!roll) return; 

        const total = parseFloat(item.meters) * parseFloat(item.pricePerMeter); 
        
        setNewOrder({ 
            ...newOrder, 
            items: [...(newOrder.items||[]), { 
                ...item, 
                subCode: roll.subCode, 
                description: roll.description,
                designCol: roll.designCol || '', 
                rollColor: roll.rollColor || '',
                totalPrice: total 
            }] 
        }); 
        setItem({ fabricCode: '', rollId: '', meters: '', pricePerMeter: '' }); 
    } else {
        alert("Please complete all fabric fields (Fabric, Roll, Meters, Price) before adding.");
    }
  };

  const deductStock = async (orderItems) => { 
    for (const orderItem of orderItems) { 
        const fabric = fabrics.find(f => String(f.mainCode) === String(orderItem.fabricCode)); 
        if(fabric) { 
            const updatedRolls = fabric.rolls.map(r => { 
                if(String(r.rollId) === String(orderItem.rollId)) { 
                    const currentMeters = parseFloat(r.meters || 0);
                    const soldMeters = parseFloat(orderItem.meters || 0);
                    const newMeters = Math.max(0, currentMeters - soldMeters);
                    return { ...r, meters: newMeters }; 
                } 
                return r; 
            }); 
            await updateDoc(doc(db, "fabrics", fabric.id), { rolls: updatedRolls }); 
        }
    }
  };

  const saveOrder = async () => { 
    if(!newOrder.customer) return alert("Please select a customer.");

    const subtotal = (newOrder.items||[]).reduce((s, i) => s + (parseFloat(i.totalPrice)||0), 0); 
    const vat = subtotal * (newOrder.vatRate / 100); 
    const final = subtotal + vat; 
    const orderToSave = { ...newOrder, subtotal, vatAmount: vat, finalPrice: final }; 
    
    if (editingId) { 
        const oldOrder = orders.find(o => o.id === editingId);
        if (oldOrder.status !== 'Completed' && newOrder.status === 'Completed') {
            await deductStock(newOrder.items);
        }
        await updateDoc(doc(db, "orders", editingId), orderToSave); 
    } else { 
        if (newOrder.status === 'Completed') {
            await deductStock(newOrder.items); 
        }
        await addDoc(collection(db, "orders"), orderToSave); 
    } 
    setShowAdd(false); 
    setEditingId(null); 
    setNewOrder({ customer: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, status: 'Pending', items: [] }); 
  };

  const updateStatus = async (id, newStatus) => { 
    const order = orders.find(o => o.id === id); 
    if (order.status !== 'Completed' && newStatus === 'Completed') {
        await deductStock(order.items); 
    }
    await updateDoc(doc(db, "orders", id), { status: newStatus }); 
  };

  const deleteOrder = async (id) => { if(confirm("Delete this invoice?")) await deleteDoc(doc(db, "orders", id)); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-white border p-2 rounded-lg text-slate-500 hover:bg-slate-50"><ArrowLeft/></button>
            <div><h2 className="text-2xl font-bold text-slate-800">Sales Invoices</h2><p className="text-slate-500">Manage customer orders and billing</p></div>
        </div>
        <button onClick={handleNewInvoice} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"><Plus size={20}/> New Invoice</button>
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 animate-in fade-in">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-xl text-slate-800">{editingId ? 'Edit Invoice' : 'New Invoice'}</h3>
             <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X/></button>
          </div>
          
          <div className="mb-4 bg-blue-50 p-3 rounded-lg flex items-center gap-2">
             <Hash size={16} className="text-blue-500"/> 
             <span className="text-sm font-bold text-blue-800">Internal Order ID:</span> 
             <span className="font-mono text-sm text-blue-600">{newOrder.orderId || 'Auto-generated on save'}</span>
          </div>

          <div className="grid grid-cols-5 gap-6 mb-8 items-end">
            {/* NEW: Custom Searchable Customer Dropdown */}
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Customer</label>
              <SearchableSelect 
                options={(customers || []).map(c => ({ value: c.name, label: c.name }))}
                value={newOrder.customer}
                onChange={(val) => setNewOrder({ ...newOrder, customer: val })}
                placeholder="Search or Select Customer..."
              />
            </div>
            
            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Invoice #</label><input className="w-full border border-slate-300 shadow-sm p-3 rounded-lg bg-white" value={newOrder.invoiceNo} onChange={e => setNewOrder({ ...newOrder, invoiceNo: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Date</label><input type="date" className="w-full border border-slate-300 shadow-sm p-3 rounded-lg bg-white" value={newOrder.date} onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Status</label><select className="w-full border border-slate-300 shadow-sm p-3 rounded-lg bg-white font-bold text-blue-800" value={newOrder.status} onChange={e => setNewOrder({ ...newOrder, status: e.target.value })}><option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select></div>
          </div>
          
          <div className="bg-blue-50 p-6 rounded-xl mb-6">
            <h4 className="font-bold text-blue-800 mb-4 text-sm uppercase">Select Stock to Sell</h4>
            <div className="flex gap-4 mb-4 items-end">
              
              {/* NEW: Custom Searchable Fabric Dropdown */}
              <div className="flex-1">
                  <label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Fabric Code</label>
                  <SearchableSelect 
                    options={fabrics.map(f => ({ value: f.mainCode, label: `${f.mainCode} - ${f.name}` }))}
                    value={item.fabricCode}
                    onChange={(val) => setItem({ ...item, fabricCode: val, rollId: '' })}
                    placeholder="Search Fabric..."
                  />
              </div>

              {/* NEW: Custom Searchable Roll Dropdown */}
              <div className="flex-1">
                  <label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Roll ID</label>
                  <SearchableSelect 
                    options={(selectedFabric?.rolls || []).map(r => ({ 
                      value: r.rollId, 
                      label: `${r.subCode} | ${r.rollColor || '-'} | ${(parseFloat(r.meters)||0).toFixed(2)}m (${r.location || 'Loc?'})` 
                    }))}
                    value={item.rollId}
                    onChange={(val) => setItem({ ...item, rollId: val })}
                    placeholder="Select Roll..."
                    disabled={!item.fabricCode}
                  />
              </div>

              <div className="w-24"><label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Meters</label><input type="number" placeholder="Meters" className="border border-slate-300 shadow-sm p-3 rounded-lg w-full bg-white font-bold" value={item.meters} onChange={e => setItem({ ...item, meters: e.target.value })} /></div>
              <div className="w-28"><label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">Price/M (€)</label><input type="number" placeholder="Price" className="border border-slate-300 shadow-sm p-3 rounded-lg w-full bg-white font-bold" value={item.pricePerMeter} onChange={e => setItem({ ...item, pricePerMeter: e.target.value })} /></div>
              <button onClick={addItem} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 h-[50px]">Add</button>
            </div>

            {/* List Items */}
            {(newOrder.items||[]).length > 0 && (
                <div className="bg-white rounded-lg border overflow-hidden mt-6">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-slate-500"><tr><th className="text-left p-3">Item</th><th className="text-right p-3">Details</th><th className="text-right p-3">Total</th><th className="text-right p-3"></th></tr></thead>
                        <tbody>
                            {(newOrder.items||[]).map((i, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-3 font-medium text-slate-700">
                                        <span className="font-bold">{i.fabricCode}</span>
                                        <span className="text-slate-400 mx-2">|</span>
                                        <span className="text-blue-600">{i.subCode}</span>
                                        {i.rollColor && <span className="text-xs text-slate-400 ml-2">({i.rollColor})</span>}
                                    </td>
                                    <td className="p-3 text-right text-slate-500">{i.meters}m x €{i.pricePerMeter}</td>
                                    <td className="p-3 text-right font-bold text-slate-800">€{(parseFloat(i.totalPrice)||0).toFixed(2)}</td>
                                    <td className="p-3 text-right"><button onClick={() => setNewOrder({...newOrder, items: newOrder.items.filter((_, x) => x !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
          <div className="flex justify-end gap-3"><button onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button onClick={saveOrder} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700">Save Invoice</button></div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold"><tr><th className="p-4 pl-6">Order ID</th><th className="p-4">Invoice</th><th className="p-4">Customer</th><th className="p-4">Date</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Status</th><th className="p-4 text-right pr-6">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(orders||[]).filter(o => o.date >= dateRangeStart && o.date <= dateRangeEnd).map(order => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 pl-6 font-mono text-xs text-slate-500">{order.orderId || '-'}</td>
                <td className="p-4 font-bold text-slate-800">{order.invoiceNo}</td>
                <td className="p-4 font-bold text-slate-800">{order.customer}</td>
                <td className="p-4 text-slate-500">{order.date}</td>
                <td className="p-4 text-right font-bold text-slate-800">€{(parseFloat(order.finalPrice)||0).toFixed(2)}</td>
                <td className="p-4 text-center">
                    {order.status === 'Completed' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Completed</span>
                    ) : (
                        <select 
                            value={order.status} 
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className={`px-2 py-1 rounded text-xs font-bold border ${order.status === 'Cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    )}
                </td>
                <td className="p-4 text-right pr-6 flex justify-end gap-3">
                  <button onClick={() => setViewInvoice(order)} className="text-blue-500 hover:text-blue-700" title="View"><Eye size={18}/></button>
                  <button onClick={() => { setNewOrder(order); setEditingId(order.id); setShowAdd(true); }} className="text-slate-400 hover:text-blue-600"><Pencil size={18}/></button>
                  <button onClick={() => deleteOrder(order.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// --- UPDATED EXPENSES: MULTI-ITEM SUPPORT ---
const Expenses = ({ expenses, dateRangeStart, dateRangeEnd, onBack }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [newExpense, setNewExpense] = useState({ company: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, items: [] });
  const [currentItem, setCurrentItem] = useState({ description: '', netPrice: '' });

  if (viewInvoice) return <InvoiceViewer invoice={viewInvoice} type="Expense" onBack={() => setViewInvoice(null)} />;

  const addItem = () => {
      if (currentItem.description && currentItem.netPrice) {
          const net = parseFloat(currentItem.netPrice);
          const total = net * (1 + newExpense.vatRate/100);
          setNewExpense({ ...newExpense, items: [...newExpense.items, { ...currentItem, netPrice: net, totalPrice: total }] });
          setCurrentItem({ description: '', netPrice: '' });
      }
  };

  const saveExpense = async () => {
    const net = newExpense.items.reduce((sum, i) => sum + i.netPrice, 0);
    const vat = net * (newExpense.vatRate / 100);
    const expenseData = { ...newExpense, netPrice: net, vatAmount: vat, finalPrice: net + vat };
    
    if (editingId) { await updateDoc(doc(db, "expenses", editingId), expenseData); } 
    else { await addDoc(collection(db, "expenses"), expenseData); }
    
    setShowAdd(false);
    setEditingId(null);
    setNewExpense({ company: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], vatRate: 24, items: [] });
  };

  const handleDelete = async (id) => { if(confirm("Delete this expense?")) await deleteDoc(doc(db, "expenses", id)); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-white border p-2 rounded-lg text-slate-500 hover:bg-slate-50"><ArrowLeft/></button>
            <div><h2 className="text-2xl font-bold text-slate-800">Expenses</h2><p className="text-slate-500">Operational costs</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg flex items-center gap-2"><Plus size={20}/> New Expense</button>
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-orange-100 animate-in fade-in">
          <h3 className="font-bold text-lg mb-6">{editingId ? 'Edit' : 'New'} Expense</h3>
          <div className="grid grid-cols-4 gap-6 mb-6">
            <div><label className="text-xs font-bold text-slate-400 uppercase">Invoice #</label><input className="w-full border p-3 rounded-lg bg-slate-50 mt-1" value={newExpense.invoiceNo} onChange={e => setNewExpense({ ...newExpense, invoiceNo: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase">Company</label><input className="w-full border p-3 rounded-lg bg-slate-50 mt-1" value={newExpense.company} onChange={e => setNewExpense({ ...newExpense, company: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase">Date</label><input type="date" className="w-full border p-3 rounded-lg bg-slate-50 mt-1" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase">VAT %</label><input type="number" className="w-full border p-3 rounded-lg bg-slate-50 mt-1" value={newExpense.vatRate} onChange={e => setNewExpense({ ...newExpense, vatRate: e.target.value })} /></div>
          </div>
          
          <div className="bg-orange-50 p-6 rounded-xl mb-6">
             <h4 className="font-bold text-orange-800 mb-4 text-sm uppercase">Expense Items</h4>
             <div className="flex gap-4 mb-4 items-end">
                <div className="flex-1"><label className="text-xs font-bold text-slate-400 uppercase">Description</label><input className="w-full border p-3 rounded-lg bg-white" value={currentItem.description} onChange={e => setCurrentItem({ ...currentItem, description: e.target.value })} /></div>
                <div className="w-32"><label className="text-xs font-bold text-slate-400 uppercase">Net €</label><input type="number" className="w-full border p-3 rounded-lg bg-white" value={currentItem.netPrice} onChange={e => setCurrentItem({ ...currentItem, netPrice: e.target.value })} /></div>
                <button onClick={addItem} className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg">Add</button>
             </div>
             {newExpense.items.map((item, idx) => (
                 <div key={idx} className="flex justify-between items-center border-t border-orange-200 py-2">
                     <span className="text-orange-900">{item.description}</span>
                     <span className="text-orange-900 font-bold">€{item.netPrice.toFixed(2)}</span>
                     <button onClick={() => setNewExpense({...newExpense, items: newExpense.items.filter((_, i) => i !== idx)})} className="text-red-500"><Trash2 size={16}/></button>
                 </div>
             ))}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-lg font-bold text-slate-500">Cancel</button>
            <button onClick={saveExpense} className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg">Save</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold"><tr><th className="p-4 pl-6">Invoice</th><th className="p-4">Company</th><th className="p-4">Date</th><th className="p-4 text-right">Net</th><th className="p-4 text-right">VAT</th><th className="p-4 text-right">Total</th><th className="p-4 text-right pr-6"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {/* FIXED: BLANK SCREEN (|| []) */}
            {(expenses||[]).filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd).map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="p-4 pl-6 font-mono text-slate-600">#{e.invoiceNo}</td>
                <td className="p-4 font-bold text-slate-800">{e.company}</td>
                <td className="p-4 text-slate-500">{e.date}</td>
                <td className="p-4 text-right">€{e.netPrice.toFixed(2)}</td>
                <td className="p-4 text-right">€{e.vatAmount.toFixed(2)}</td>
                <td className="p-4 text-right font-bold text-slate-800">€{e.finalPrice.toFixed(2)}</td>
                <td className="p-4 text-right pr-6 flex justify-end gap-3">
                  <button onClick={() => setViewInvoice(e)} className="text-blue-500 hover:text-blue-700"><Eye size={18}/></button>
                  <button onClick={() => { setNewExpense(e); setEditingId(e.id); setShowAdd(true); }} className="text-slate-400 hover:text-blue-600"><Pencil size={18}/></button>
                  <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
};

const ContactList = ({ title, data, collectionName, onBack }) => {
   const [showAdd, setShowAdd] = useState(false); const [editingId, setEditingId] = useState(null); const [newContact, setNewContact] = useState({ name: '', contact: '', email: '', phone: '', vatNumber: '', address: '', city: '', postalCode: '', iban: '' });
   const handleSave = async () => { if (editingId) { await updateDoc(doc(db, collectionName, editingId), newContact); } else { await addDoc(collection(db, collectionName), newContact); } setShowAdd(false); setEditingId(null); setNewContact({ name: '', contact: '', email: '', phone: '', vatNumber: '', address: '', city: '', postalCode: '', iban: '' }); };
   const handleDelete = async (id) => { if(confirm("Delete this contact?")) await deleteDoc(doc(db, collectionName, id)); }
   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="bg-white border p-2 rounded-lg text-slate-500 hover:bg-slate-50"><ArrowLeft/></button>
                <div><h2 className="text-2xl font-bold text-slate-800">{title}</h2><p className="text-slate-500">Manage directory</p></div>
            </div>
            <button onClick={() => setShowAdd(true)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black shadow-lg flex items-center gap-2"><Plus size={20}/> Add {title}</button>
         </div>
         {showAdd && (<div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"><h3 className="font-bold text-lg mb-6">{editingId ? `Edit` : `Add`} {title}</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"><input className="border p-3 rounded-lg bg-slate-50" placeholder="Company Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="VAT Number" value={newContact.vatNumber} onChange={e => setNewContact({...newContact, vatNumber: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="Contact Person" value={newContact.contact} onChange={e => setNewContact({...newContact, contact: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="Address" value={newContact.address} onChange={e => setNewContact({...newContact, address: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="City" value={newContact.city} onChange={e => setNewContact({...newContact, city: e.target.value})} /><input className="border p-3 rounded-lg bg-slate-50" placeholder="IBAN" value={newContact.iban} onChange={e => setNewContact({...newContact, iban: e.target.value})} /></div><div className="flex justify-end gap-3"><button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-6 py-3 rounded-lg font-bold text-slate-500">Cancel</button><button onClick={handleSave} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold shadow-lg">Save</button></div></div>)}
         {/* FIXED: BLANK SCREEN (|| []) */}
         <div className="bg-white border rounded-xl shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-semibold"><tr><th className="p-4 pl-6">Company</th><th className="p-4">Contact</th><th className="p-4">Details</th><th className="p-4 text-right pr-6">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{(data||[]).map(d => (<tr key={d.id} className="hover:bg-slate-50"><td className="p-4 pl-6"><p className="font-bold text-slate-800">{d.name}</p><p className="text-xs text-slate-400">{d.vatNumber}</p></td><td className="p-4"><p className="text-slate-700">{d.contact}</p><p className="text-xs text-slate-400">{d.phone}</p></td><td className="p-4 text-slate-500 text-xs">{d.address} {d.city} {d.iban}</td><td className="p-4 text-right pr-6 flex justify-end gap-3"><button onClick={() => { setNewContact(d); setEditingId(d.id); setShowAdd(true); }} className="text-slate-400 hover:text-blue-600"><Pencil size={18}/></button><button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
      </div>
   );
};

// --- UPDATED SAMPLES: SMART ROLL DROPDOWN ---
const SamplesTab = ({ samples, customers, fabrics, onBack }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [viewLog, setViewLog] = useState(null); 
  const [editingId, setEditingId] = useState(null); 
  const [newLog, setNewLog] = useState({ date: new Date().toISOString().split('T')[0], customer: '', notes: '', items: [] });
  // NEW: Added price to item state
  const [item, setItem] = useState({ fabricCode: '', description: '', meters: '', price: '' });

  if (viewLog) return <SampleSlipViewer sampleLog={viewLog} onBack={() => setViewLog(null)} />;
  
  const addItem = () => { if(item.fabricCode) { setNewLog({...newLog, items: [...newLog.items, item]}); setItem({ fabricCode: '', description: '', meters: '', price: '' }); }};
  const saveLog = async () => { if (newLog.customer && newLog.items.length > 0) { if (editingId) { await updateDoc(doc(db, "samples", editingId), newLog); } else { await addDoc(collection(db, "samples"), { ...newLog, createdAt: Date.now() }); } setShowAdd(false); setEditingId(null); setNewLog({ date: new Date().toISOString().split('T')[0], customer: '', notes: '', items: [] }); }};
  const handleEdit = (log) => { setNewLog(log); setEditingId(log.id); setShowAdd(true); };
  const deleteSample = async (id) => { if(confirm("Delete this log?")) await deleteDoc(doc(db, "samples", id)); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-white border p-2 rounded-lg text-slate-500 hover:bg-slate-50"><ArrowLeft/></button>
            <div><h2 className="text-2xl font-bold text-slate-800">Sample Shipments</h2><p className="text-slate-500">Track samples sent to prospects</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex items-center gap-2"><Plus size={20}/> New Shipment</button>
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-purple-100 animate-in fade-in">
          <h3 className="font-bold text-lg mb-6 text-slate-800">{editingId ? 'Edit Shipment' : 'Log Shipment'}</h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
             <div><label className="text-xs font-bold text-slate-400 uppercase">Date</label><input type="date" className="w-full border p-3 rounded-lg bg-slate-50 mt-1" value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} /></div>
             <div><label className="text-xs font-bold text-slate-400 uppercase">Customer (Type/Select)</label><input className="w-full border p-3 rounded-lg bg-slate-50 mt-1" list="customer-options" value={newLog.customer} onChange={e => setNewLog({...newLog, customer: e.target.value})} placeholder="e.g. New Lead Corp"/><datalist id="customer-options">{(customers || []).map(c => <option key={c.id} value={c.name} />)}</datalist></div>
             <div className="col-span-2"><label className="text-xs font-bold text-slate-400 uppercase">Notes</label><input className="w-full border p-3 rounded-lg bg-slate-50 mt-1" placeholder="e.g. Sent via DHL" value={newLog.notes} onChange={e => setNewLog({...newLog, notes: e.target.value})} /></div>
          </div>
          <div className="bg-purple-50 p-6 rounded-xl mb-6">
             <h4 className="font-bold text-purple-800 mb-4 text-sm uppercase">Fabrics</h4>
             <div className="flex gap-4 items-end mb-2">
                {/* NEW: Smart Dropdown listing ROLLS */}
                <div className="flex-1"><label className="text-xs font-bold text-purple-400">Fabric/Roll</label><input className="w-full border p-3 rounded-lg bg-white" list="fabric-roll-options" value={item.fabricCode} onChange={e => setItem({...item, fabricCode: e.target.value})} placeholder="Select Roll or Type Name"/>
                  <datalist id="fabric-roll-options">
                    {(fabrics || []).flatMap(fabric => 
                      (fabric.rolls || []).map(roll => (
                        <option 
                          key={roll.rollId} 
                          value={`${fabric.mainCode} ${roll.subCode} - ${fabric.name}`} 
                        />
                      ))
                    )}
                  </datalist>
                </div>
                
                <div className="flex-1"><label className="text-xs font-bold text-purple-400">Details</label><input className="w-full border p-3 rounded-lg bg-white" placeholder="Color / Subcode" value={item.description} onChange={e => setItem({...item, description: e.target.value})} /></div>
                <div className="w-24"><label className="text-xs font-bold text-purple-400">Length</label><input className="w-full border p-3 rounded-lg bg-white" placeholder="M" value={item.meters} onChange={e => setItem({...item, meters: e.target.value})} /></div>
                {/* NEW: Price Field */}
                <div className="w-24"><label className="text-xs font-bold text-purple-400">Price (€)</label><input className="w-full border p-3 rounded-lg bg-white" placeholder="€" value={item.price} onChange={e => setItem({...item, price: e.target.value})} /></div>
                <button onClick={addItem} className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold h-[50px] shadow-md">Add</button>
             </div>
             {newLog.items.map((i, idx) => (
                 <div key={idx} className="flex justify-between items-center border-t border-purple-100 py-2 mt-2">
                    <span className="font-bold text-purple-900">{i.fabricCode}</span>
                    <span className="text-purple-600">{i.description}</span>
                    <span className="text-purple-800 font-mono">{i.meters ? i.meters + 'm' : ''}</span>
                    <span className="text-purple-700 font-bold">{i.price ? '€'+i.price : ''}</span>
                    <button onClick={() => setNewLog({...newLog, items: newLog.items.filter((_, x) => x !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                 </div>
             ))}
          </div>
          <div className="flex justify-end gap-3"><button onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button onClick={saveLog} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-purple-700">Save Log</button></div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold"><tr><th className="p-4 pl-6">Date</th><th className="p-4">Customer</th><th className="p-4 text-center">Items</th><th className="p-4">Notes</th><th className="p-4 text-right pr-6">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {/* FIXED: BLANK SCREEN */}
            {(samples || []).length > 0 ? samples.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 pl-6 text-slate-500">{s.date}</td><td className="p-4 font-bold text-slate-800">{s.customer}</td><td className="p-4 text-center"><span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">{(s.items || []).length} Fabrics</span></td><td className="p-4 text-slate-500 italic">{s.notes}</td>
                <td className="p-4 text-right pr-6 flex justify-end gap-3"><button onClick={() => setViewLog(s)} className="text-blue-500 hover:text-blue-700"><Eye size={18}/></button><button onClick={() => handleEdit(s)} className="text-slate-400 hover:text-blue-600"><Pencil size={18}/></button><button onClick={() => deleteSample(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button></td>
              </tr>
            )) : <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No shipments logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
    // Dynamically Load PDF Script
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    document.body.appendChild(script);

    if (!isAuthenticated) return;
    const unsubFab = onSnapshot(collection(db, 'fabrics'), (snap) => setFabrics(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubOrd = onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPur = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc')), (snap) => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSup = onSnapshot(collection(db, 'suppliers'), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCus = onSnapshot(collection(db, 'customers'), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSamp = onSnapshot(query(collection(db, 'samples'), orderBy('createdAt', 'desc')), (snap) => setSamples(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubFab(); unsubOrd(); unsubPur(); unsubExp(); unsubSup(); unsubCus(); unsubSamp(); document.body.removeChild(script); };
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
              <p className="text-xs text-slate-500 uppercase tracking-widest">Enterprise 5.10</p>
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
        <div className="flex-1 overflow-y-auto p-8" id="main-scroll-container">
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