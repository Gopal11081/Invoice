import 'server-only';
import { db, ensureInitialized } from './connection';

export async function getDashboardData() {
  await ensureInitialized();
  const snapshot = await db.collection('invoices')
    .where('is_deleted', '==', false)
    .select(
      'id', 'invoice_number', 'invoice_date', 'buyer_name',
      'grand_total', 'taxable_amount', 'total_discount',
      'cgst', 'sgst', 'igst', 'items', 'supply_type', 'created_at', 'email_status'
    )
    .get();
  const invoices = [];
  snapshot.forEach(doc => invoices.push(doc.data()));

  // Recalculate financial fields from items for invoices where grand_total is 0 (fixes existing data affected by schema bug)
  invoices.forEach(inv => {
    if (!(inv.grand_total) && inv.items && inv.items.length > 0) {
      let subtotal = 0;
      let totalDiscount = 0;
      let taxableTotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      inv.items.forEach(item => {
        const gross = (item.qty || 1) * (item.rate || 0);
        const discAmt = gross * ((item.discount_percent || 0) / 100);
        const rowTotal = gross - discAmt;
        const gstRate = item.gst_rate || 18;
        const taxable = rowTotal / (1 + (gstRate / 100));
        const taxAmount = rowTotal - taxable;

        subtotal += gross;
        totalDiscount += discAmt;
        taxableTotal += taxable;

        if (inv.supply_type === 'inter') {
          totalIgst += taxAmount;
        } else {
          totalCgst += taxAmount / 2;
          totalSgst += taxAmount / 2;
        }
      });

      inv.grand_total = taxableTotal + totalCgst + totalSgst + totalIgst;
      inv.taxable_amount = taxableTotal;
      inv.total_discount = totalDiscount;
      inv.cgst = totalCgst;
      inv.sgst = totalSgst;
      inv.igst = totalIgst;
    }
  });

  // 1. Overall totals
  let total_invoices = invoices.length;
  let total_sales = 0;
  let total_taxable = 0;
  let total_discount = 0;
  let total_cgst = 0;
  let total_sgst = 0;
  let total_igst = 0;
  let total_tax = 0;

  invoices.forEach(inv => {
    total_sales += inv.grand_total || 0;
    total_taxable += inv.taxable_amount || 0;
    total_discount += inv.total_discount || 0;
    total_cgst += inv.cgst || 0;
    total_sgst += inv.sgst || 0;
    total_igst += inv.igst || 0;
  });
  total_tax = total_cgst + total_sgst + total_igst;
  let avg_invoice = total_invoices > 0 ? total_sales / total_invoices : 0;

  const totals = {
    total_invoices,
    total_sales,
    avg_invoice,
    total_taxable,
    total_discount,
    total_cgst,
    total_sgst,
    total_igst,
    total_tax
  };

  // 2. Current Month vs Previous Month Totals
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  let currentMonthSales = 0;
  let currentMonthCount = 0;
  let prevMonthSales = 0;
  let prevMonthCount = 0;

  invoices.forEach(inv => {
    if (inv.invoice_date && inv.invoice_date.startsWith(currentMonthStr)) {
      currentMonthSales += inv.grand_total || 0;
      currentMonthCount++;
    } else if (inv.invoice_date && inv.invoice_date.startsWith(prevMonthStr)) {
      prevMonthSales += inv.grand_total || 0;
      prevMonthCount++;
    }
  });

  const currentMonth = { invoices: currentMonthCount, sales: currentMonthSales };
  const prevMonth = { invoices: prevMonthCount, sales: prevMonthSales };

  // 3. Monthly sales for last 12 months
  const monthlySales = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    let sales = 0;
    let count = 0;
    invoices.forEach(inv => {
      if (inv.invoice_date && inv.invoice_date.startsWith(mStr)) {
        sales += inv.grand_total || 0;
        count++;
      }
    });
    monthlySales.push({ month: mStr, sales, count });
  }

  // 4. Top 5 products by revenue
  const productRevenueMap = {};
  const productQtyMap = {};
  const productInvoiceCountMap = {};

  invoices.forEach(inv => {
    const uniqueItemsInInvoice = new Set();
    if (inv.items) {
      inv.items.forEach(item => {
        const desc = item.description || '';
        if (desc) {
          const gross = (item.qty || 1) * (item.rate || 0);
          const discAmt = gross * ((item.discount_percent || 0) / 100);
          const rowTotal = gross - discAmt;
          productRevenueMap[desc] = (productRevenueMap[desc] || 0) + rowTotal;
          productQtyMap[desc] = (productQtyMap[desc] || 0) + (item.qty || 0);
          uniqueItemsInInvoice.add(desc);
        }
      });
    }
    uniqueItemsInInvoice.forEach(desc => {
      productInvoiceCountMap[desc] = (productInvoiceCountMap[desc] || 0) + 1;
    });
  });

  const topProducts = Object.keys(productRevenueMap).map(desc => ({
    description: desc,
    total_qty: productQtyMap[desc],
    total_sales: productRevenueMap[desc],
    invoice_count: productInvoiceCountMap[desc] || 0
  })).sort((a, b) => b.total_sales - a.total_sales).slice(0, 5);

  // 5. Top 5 customers by spending
  const customerSpendingMap = {};
  const customerInvoiceCountMap = {};

  invoices.forEach(inv => {
    const name = inv.buyer_name || '';
    if (name) {
      customerSpendingMap[name] = (customerSpendingMap[name] || 0) + (inv.grand_total || 0);
      customerInvoiceCountMap[name] = (customerInvoiceCountMap[name] || 0) + 1;
    }
  });

  const topCustomers = Object.keys(customerSpendingMap).map(name => ({
    buyer_name: name,
    invoice_count: customerInvoiceCountMap[name],
    total_sales: customerSpendingMap[name]
  })).sort((a, b) => b.total_sales - a.total_sales).slice(0, 5);

  // 6. Recent 5 invoices
  const recentInvoices = [...invoices]
    .sort((a, b) => {
      const dateA = a.invoice_date || '';
      const dateB = b.invoice_date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    })
    .slice(0, 5)
    .map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      buyer_name: inv.buyer_name,
      grand_total: inv.grand_total || 0
    }));

  // 7. Sales by supply type
  const supplyMap = { intra: { count: 0, total: 0 }, inter: { count: 0, total: 0 } };
  invoices.forEach(inv => {
    const type = inv.supply_type === 'inter' ? 'inter' : 'intra';
    supplyMap[type].count++;
    supplyMap[type].total += inv.grand_total || 0;
  });
  const supplyBreakdown = [
    { supply_type: 'intra', count: supplyMap.intra.count, total: supplyMap.intra.total },
    { supply_type: 'inter', count: supplyMap.inter.count, total: supplyMap.inter.total }
  ];

  return {
    totals,
    currentMonth,
    prevMonth,
    monthlySales,
    topProducts,
    topCustomers,
    recentInvoices,
    supplyBreakdown
  };
}
