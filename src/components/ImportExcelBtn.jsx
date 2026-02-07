import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, Loader2 } from 'lucide-react';
import { db } from '../firebase'; 
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const ImportExcelBtn = ({ targetCollection = 'fabrics', mode = 'upload', onImportSuccess, onDataRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  // --- MAPPING CONFIGURATION ---
  // We use this to translate Scanpet columns (like "Barcode") to your App columns ("fabricCode")
  const MAPPINGS = {
    // Mode for Purchase Form Filling
    purchaseItems: {
      transform: (row) => ({
        // Scanpet usually exports "Barcode", "Quantity". We map them here:
        fabricCode: String(row['Barcode'] || row['Code'] || row['MainCode'] || '').trim(),
        subCode: String(row['SubCode'] || row['RollID'] || 'NEW'), 
        description: String(row['Description'] || row['Desc'] || ''),
        meters: parseFloat(row['Quantity'] || row['Qty'] || row['Meters']) || 0,
        pricePerMeter: parseFloat(row['Price'] || row['Cost']) || 0,
        totalPrice: (parseFloat(row['Quantity'] || 0) * parseFloat(row['Price'] || 0)) || 0
      })
    },
    // Mode for Direct Database Uploads
    fabrics: {
      required: ['MainCode', 'Name'],
      transform: (row) => ({
        mainCode: String(row['MainCode'] || '').trim(),
        name: String(row['Name'] || '').trim(),
        color: String(row['Color'] || ''),
        supplier: String(row['Supplier'] || ''),
        rolls: []
      })
    },
    customers: {
      required: ['Name'],
      transform: (row) => ({ name: String(row['Name'] || '').trim() }) // Simplified for brevity
    },
    suppliers: {
      required: ['Name'],
      transform: (row) => ({ name: String(row['Name'] || '').trim() })
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        if (jsonData.length > 0) {
          setColumns(Object.keys(jsonData[0]));
          setPreviewData(jsonData);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleProcess = async () => {
    setIsUploading(true);
    setStatus('Processing...');
    
    try {
      // 1. READ-ONLY MODE (For Purchase Form)
      if (mode === 'read-only') {
        const config = MAPPINGS['purchaseItems'];
        // Transform the raw Excel rows into your App's item format
        const cleanData = previewData
          .filter(row => row['Barcode'] || row['Code'] || row['MainCode']) // Ensure row has a code
          .map(config.transform);
          
        onDataRead(cleanData); // Send data back to the Purchase Form
        setStatus(`Success! Loaded ${cleanData.length} items.`);
        setTimeout(closeModal, 1000);
      } 
      
      // 2. UPLOAD MODE (For Database Import)
      else {
        const config = MAPPINGS[targetCollection];
        let added = 0, skipped = 0;

        for (const row of previewData) {
           if (!row[config.required?.[0]]) continue;
           const docData = config.transform(row);
           
           // Simple Duplicate Check
           const checkField = targetCollection === 'fabrics' ? 'mainCode' : 'name';
           const q = query(collection(db, targetCollection), where(checkField, '==', docData[checkField]));
           const snap = await getDocs(q);

           if (snap.empty) {
             await addDoc(collection(db, targetCollection), docData);
             added++;
           } else skipped++;
        }
        setStatus(`Done! Added: ${added}, Skipped: ${skipped}`);
        setTimeout(closeModal, 2000);
      }
    } catch (error) {
      setStatus('Error: ' + error.message);
      setIsUploading(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false); setFile(null); setPreviewData([]); setIsUploading(false); setStatus('');
    if(onImportSuccess) onImportSuccess();
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 text-sm font-bold shadow-sm">
        <FileSpreadsheet size={16}/> {mode === 'read-only' ? 'Fill from Excel' : 'Import Excel'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Import {mode === 'read-only' ? 'Items' : 'Data'}</h2>
              <button onClick={() => setIsOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
               {!file ? (
                 <div onClick={() => fileInputRef.current.click()} className="border-2 border-dashed border-slate-300 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-all">
                   <Upload className="text-slate-400 mb-2"/>
                   <span className="font-bold text-slate-500">Click to Upload Scanpet Excel</span>
                   <p className="text-xs text-slate-400 mt-1">Supports: Barcode, Quantity, Price, Description columns</p>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .csv" className="hidden"/>
                 </div>
               ) : (
                 <div className="space-y-4">
                    <div className="flex justify-between bg-slate-50 p-3 rounded-lg"><span className="font-bold">{file.name}</span><button onClick={() => setFile(null)} className="text-red-500 text-xs font-bold">CHANGE</button></div>
                    {/* Preview Table */}
                    <div className="border rounded-lg overflow-auto max-h-60"><table className="w-full text-xs text-left"><thead className="bg-slate-100 font-bold sticky top-0"><tr>{columns.map(c => <th key={c} className="p-2 border-b">{c}</th>)}</tr></thead><tbody>{previewData.slice(0,5).map((r,i) => <tr key={i} className="border-b">{columns.map(c => <td key={c} className="p-2">{r[c]}</td>)}</tr>)}</tbody></table></div>
                    {status && <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex gap-2 items-center">{isUploading && <Loader2 className="animate-spin" size={14}/>}{status}</div>}
                 </div>
               )}
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
               <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
               {file && <button onClick={handleProcess} disabled={isUploading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-700">{isUploading ? 'Processing...' : 'Load Items'}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportExcelBtn;