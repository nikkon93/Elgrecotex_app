import React, { useState } from 'react';
import { Package, Plus, Trash2, Search, Download, Upload } from 'lucide-react';
import { 
  getUniqueSubcodes, 
  calculateTotalMeters, 
  calculateSubcodeMeters, 
  calculateAveragePurchasePrice, 
  calculateWarehouseValue,
  calculateTotalWarehouseValue 
} from '../utils/calculations';

// --- 1. The AddRollForm Component ---
const AddRollForm = ({ fabricId, mainCode, existingRolls, onAdd, onCancel }) => {
  const [rollData, setRollData] = useState({
    subCode: `${mainCode}-${getUniqueSubcodes(existingRolls).length + 1}`,
    meters: '',
    location: '',
    image: '',
    manualPrice: ''
  });

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-800">Add New Physical Roll</h4>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sub Code</label>
          <input type="text" placeholder="100-1" value={rollData.subCode} onChange={(e) => setRollData({...rollData, subCode: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Meters</label>
          <input type="number" step="0.01" placeholder="87" value={rollData.meters} onChange={(e) => setRollData({...rollData, meters: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <input type="text" placeholder="A1" value={rollData.location} onChange={(e) => setRollData({...rollData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price/m</label>
          <input type="number" step="0.01" placeholder="€10.00" value={rollData.manualPrice} onChange={(e) => setRollData({...rollData, manualPrice: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Roll Image</label>
        <input type="text" placeholder="Image URL" value={rollData.image} onChange={(e) => setRollData({...rollData, image: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => rollData.subCode && rollData.meters && rollData.location && onAdd(fabricId, { ...rollData, meters: parseFloat(rollData.meters), manualPrice: rollData.manualPrice ? parseFloat(rollData.manualPrice) : undefined })} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Roll</button>
        <button onClick={onCancel} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
      </div>
    </div>
  );
};

// --- 2. The InventoryTab Component ---
export const InventoryTab = ({
  fabrics,
  purchases,
  searchTerm,
  setSearchTerm,
  showAddFabric,
  setShowAddFabric,
  newFabricData,
  setNewFabricData,
  showAddRoll,
  setShowAddRoll,
  exportInventory,
  importInventory,
  addFabric,
  addRoll,
  deleteRoll,
  deleteFabric
}) => {
  
  const filteredFabrics = searchTerm.trim() === '' ? fabrics : fabrics.filter(fabric => {
    const searchLower = searchTerm.toLowerCase();
    return fabric.mainCode.toLowerCase().includes(searchLower) ||
           fabric.name.toLowerCase().includes(searchLower) ||
           fabric.color.toLowerCase().includes(searchLower) ||
           fabric.rolls.some(roll => roll.subCode.toLowerCase().includes(searchLower));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Fabric Inventory</h2>
          <p className="text-lg text-emerald-700 font-semibold mt-2">
            Total Stock Value: €{calculateTotalWarehouseValue(fabrics, purchases).toFixed(2)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportInventory('excel')} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={() => exportInventory('csv')} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <label className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 cursor-pointer">
            <Upload className="w-4 h-4" /> Import
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importInventory} className="hidden" />
          </label>
          <button onClick={() => setShowAddFabric(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Add Fabric
          </button>
        </div>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" 
        />
      </div>

      {showAddFabric && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Fabric</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <input type="text" placeholder="Main Code" value={newFabricData.mainCode} onChange={(e) => setNewFabricData({...newFabricData, mainCode: e.target.value})} className="px-3 py-2 border rounded-lg" />
            <input type="text" placeholder="Fabric Name" value={newFabricData.name} onChange={(e) => setNewFabricData({...newFabricData, name: e.target.value})} className="px-3 py-2 border rounded-lg" />
            <input type="text" placeholder="Color" value={newFabricData.color} onChange={(e) => setNewFabricData({...newFabricData, color: e.target.value})} className="px-3 py-2 border rounded-lg" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fabric Image</label>
            <input type="text" placeholder="Image URL" value={newFabricData.image || ''} onChange={(e) => setNewFabricData({...newFabricData, image: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button onClick={addFabric} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => { setShowAddFabric(false); setNewFabricData({ mainCode: '', name: '', color: '', image: '' }); }} className="bg-gray-300 px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredFabrics.map(fabric => {
          const uniqueSubcodes = getUniqueSubcodes(fabric.rolls);
          const warehouseValue = calculateWarehouseValue(fabric, purchases, fabrics);
          return (
            <div key={fabric.id} className="bg-white border rounded-lg">
              <div className="bg-gray-50 p-4 border-b">
                <div className="flex justify-between">
                  <div className="flex gap-4">
                    {fabric.image && <img src={fabric.image} alt={fabric.name} className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300" onError={(e) => { e.target.style.display = 'none'; }} />}
                    <div>
                      <h3 className="text-lg font-semibold">Code: {fabric.mainCode} - {fabric.name}</h3>
                      <p className="text-sm text-gray-600">Color: {fabric.color}</p>
                      <p className="text-sm font-medium text-blue-600 mt-1">Total: {calculateTotalMeters(fabric)}m ({fabric.rolls.length} rolls)</p>
                      <p className="text-sm font-bold text-emerald-700 mt-1">Stock Value: €{warehouseValue.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddRoll(fabric.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"><Plus className="w-3 h-3 inline" /> Add Roll</button>
                    <button onClick={() => deleteFabric(fabric.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"><Trash2 className="w-3 h-3 inline" /> Delete Fabric</button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {uniqueSubcodes.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Summary by Subcode:</p>
                    <div className="flex flex-wrap gap-3">
                      {uniqueSubcodes.map(subCode => {
                        const metersInStock = calculateSubcodeMeters(fabric.rolls, subCode);
                        const avgPrice = calculateAveragePurchasePrice(fabric.mainCode, subCode, purchases, fabrics);
                        return (
                          <div key={subCode} className="bg-white px-3 py-2 rounded border">
                            <div className="flex items-center gap-2"><span className="font-medium">{subCode}:</span> <span className="text-blue-700 font-semibold">{metersInStock}m</span></div>
                            <div className="text-xs text-gray-600 mt-1">Avg Price: €{avgPrice.toFixed(2)}/m</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <table className="w-full">
                  <thead><tr className="border-b"><th className="text-left py-2 text-sm">Roll ID</th><th className="text-left py-2 text-sm">Sub Code</th><th className="text-left py-2 text-sm">Meters</th><th className="text-left py-2 text-sm">Location</th><th className="text-right py-2 text-sm">Actions</th></tr></thead>
                  <tbody>
                    {fabric.rolls.map(roll => (
                      <tr key={roll.rollId} className="border-b hover:bg-gray-50">
                        <td className="py-3 text-sm">#{roll.rollId}</td>
                        <td className="py-3 text-sm font-medium">{roll.subCode}</td>
                        <td className="py-3 text-sm">{roll.meters}m</td>
                        <td className="py-3 text-sm">{roll.location}</td>
                        <td className="py-3 text-right"><button onClick={() => deleteRoll(fabric.id, roll.rollId)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showAddRoll === fabric.id && <div className="p-4 bg-blue-50 border-t"><AddRollForm fabricId={fabric.id} mainCode={fabric.mainCode} existingRolls={fabric.rolls} onAdd={addRoll} onCancel={() => setShowAddRoll(null)} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};