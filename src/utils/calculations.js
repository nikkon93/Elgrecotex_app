export const getUniqueSubcodes = (rolls) => [...new Set(rolls.map(r => r.subCode))];

export const calculateTotalMeters = (fabric) => 
  fabric.rolls.reduce((sum, roll) => sum + roll.meters, 0);

export const calculateSubcodeMeters = (rolls, subCode) => 
  rolls.filter(r => r.subCode === subCode).reduce((sum, roll) => sum + roll.meters, 0);

export const calculateAveragePurchasePrice = (fabricCode, subCode, purchases, fabrics) => {
  // Get prices from purchase invoices
  const relevantPurchases = purchases.flatMap(p => 
    p.items.filter(item => item.fabricCode === fabricCode && item.subCode === subCode)
  );
  
  let totalCost = 0;
  let totalMeters = 0;
  
  // Add purchase invoice prices
  relevantPurchases.forEach(item => {
    totalCost += item.meters * item.pricePerMeter;
    totalMeters += item.meters;
  });
  
  // Add manual prices from rolls (if any)
  const fabric = fabrics.find(f => f.mainCode === fabricCode);
  if (fabric) {
    const rollsWithManualPrice = fabric.rolls.filter(r => 
      r.subCode === subCode && r.manualPrice && r.manualPrice > 0
    );
    
    rollsWithManualPrice.forEach(roll => {
      totalCost += roll.meters * roll.manualPrice;
      totalMeters += roll.meters;
    });
  }
  
  return totalMeters > 0 ? totalCost / totalMeters : 0;
};

export const calculateWarehouseValue = (fabric, purchases, fabrics) => {
  const uniqueSubcodes = getUniqueSubcodes(fabric.rolls);
  let totalValue = 0;
  
  uniqueSubcodes.forEach(subCode => {
    const metersInStock = calculateSubcodeMeters(fabric.rolls, subCode);
    const avgPrice = calculateAveragePurchasePrice(fabric.mainCode, subCode, purchases, fabrics);
    totalValue += metersInStock * avgPrice;
  });
  
  return totalValue;
};

export const calculateTotalWarehouseValue = (fabrics, purchases) => {
  return fabrics.reduce((total, fabric) => total + calculateWarehouseValue(fabric, purchases, fabrics), 0);
};