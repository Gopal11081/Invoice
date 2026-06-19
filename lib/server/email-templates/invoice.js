/**
 * Generate premium HTML email template for Tax Invoices.
 */
export function getInvoiceEmailHtml({
  invoice,
  business,
  itemsHtml,
  shareUrl,
  actionText,
  isUpdate,
  businessName,
  escapeHtml,
  getStateName,
  formatNumber,
  formatDateDisplay
}) {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f1f5f9; border-radius: 16px; max-width: 650px; margin: 0 auto; border: 1px solid rgba(148, 163, 184, 0.1); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); overflow: hidden;">
      <!-- Premium Top Accent Gradient -->
      <div style="height: 6px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #38bdf8 100%);"></div>
      
      <div style="padding: 2.5rem 1.5rem;">
        <!-- Header Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; border-bottom: 1px solid rgba(148, 163, 184, 0.1); padding-bottom: 1.5rem;">
          <tr>
            <td style="font-size: 1.5rem; font-weight: 700; color: #38bdf8; vertical-align: middle;">📄 InvoiceGST</td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                ${isUpdate ? 'Revised Invoice' : 'Tax Invoice'}
              </span>
            </td>
          </tr>
        </table>

        <!-- Intro -->
        <div style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.25rem; font-weight: 600; color: #ffffff; margin: 0 0 0.5rem 0;">Dear ${escapeHtml(invoice.buyer_name || 'Customer')},</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin: 0;">
            A tax invoice has been ${actionText} for your recent transaction. Please find the details of your invoice below.
          </p>
        </div>

        <!-- Key Info Cards Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.05); padding: 1rem;">
          <tr>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Invoice Number</span>
              <strong style="color: #ffffff; font-size: 1rem;">${invoice.invoice_number}</strong>
            </td>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Invoice Date</span>
              <strong style="color: #ffffff; font-size: 1rem;">${formatDateDisplay(invoice.invoice_date)}</strong>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Due Date</span>
              <strong style="color: #ffffff; font-size: 1rem;">${invoice.due_date ? formatDateDisplay(invoice.due_date) : 'On Receipt'}</strong>
            </td>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Grand Total</span>
              <strong style="color: #38bdf8; font-size: 1.1rem;">₹${formatNumber(invoice.grand_total)}</strong>
            </td>
          </tr>
        </table>

        <!-- Parties Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
          <tr>
            <td style="width: 48%; vertical-align: top;">
              <div style="font-size: 0.8rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Seller Details</div>
              <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
                <strong style="color: #ffffff; display: block; margin-bottom: 0.25rem;">${escapeHtml(businessName)}</strong>
                ${business?.address ? `${escapeHtml(business.address)}<br/>` : ''}
                ${business?.state_code ? `${getStateName(business.state_code)}<br/>` : ''}
                <strong>GSTIN:</strong> ${business?.gstin || 'N/A'}
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%; vertical-align: top; border-left: 1px solid rgba(148, 163, 184, 0.1); padding-left: 1.25rem;">
              <div style="font-size: 0.8rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Billing Details</div>
              <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
                <strong style="color: #ffffff; display: block; margin-bottom: 0.25rem;">${escapeHtml(invoice.buyer_name)}</strong>
                ${invoice.buyer_address ? `${escapeHtml(invoice.buyer_address)}<br/>` : ''}
                ${invoice.buyer_state ? `${getStateName(invoice.buyer_state)}<br/>` : ''}
                ${invoice.buyer_phone ? `📞 ${invoice.buyer_phone}<br/>` : ''}
                ${invoice.buyer_gstin ? `<strong>GSTIN:</strong> ${invoice.buyer_gstin}` : ''}
              </div>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <div style="margin-bottom: 2rem; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(148, 163, 184, 0.2); font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">
                <th style="padding: 0.75rem 0.5rem; text-align: center; width: 5%;">#</th>
                <th style="padding: 0.75rem 0.5rem; width: 45%;">Description</th>
                <th style="padding: 0.75rem 0.5rem; text-align: center; width: 10%;">Qty</th>
                <th style="padding: 0.75rem 0.5rem; text-align: right; width: 15%;">Rate</th>
                <th style="padding: 0.75rem 0.5rem; text-align: center; width: 10%;">GST</th>
                <th style="padding: 0.75rem 0.5rem; text-align: right; width: 15%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Totals Summary Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2.5rem;">
          <tr>
            <td style="width: 50%;"></td>
            <td style="width: 50%; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; color: #cbd5e1;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">Subtotal:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${formatNumber(invoice.subtotal)}</td>
                </tr>
                ${invoice.total_discount > 0 ? `
                <tr>
                  <td style="padding: 0.5rem 0; color: #ef4444;">Discount:</td>
                  <td style="padding: 0.5rem 0; text-align: right; color: #ef4444;">−₹${formatNumber(invoice.total_discount)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">Taxable Amount:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${formatNumber(invoice.taxable_amount)}</td>
                </tr>
                ${invoice.supply_type === 'intra' ? `
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">CGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${formatNumber(invoice.cgst)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">SGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${formatNumber(invoice.sgst)}</td>
                </tr>
                ` : `
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">IGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${formatNumber(invoice.igst)}</td>
                </tr>
                `}
                <tr style="border-top: 1px solid rgba(148, 163, 184, 0.2); font-weight: 700; font-size: 1rem; color: #ffffff;">
                  <td style="padding: 0.75rem 0; color: #38bdf8;">Grand Total:</td>
                  <td style="padding: 0.75rem 0; text-align: right; color: #38bdf8;">₹${formatNumber(invoice.grand_total)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        ${shareUrl ? `
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <a href="${shareUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 0.9rem 2.25rem; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);">
            View Invoice Online
          </a>
        </div>
        ` : ''}

        <!-- Footer & Terms -->
        <div style="border-top: 1px solid rgba(148, 163, 184, 0.1); padding-top: 1.5rem; text-align: center; font-size: 0.75rem; color: #64748b; line-height: 1.5;">
          ${business?.terms ? `
          <div style="margin-bottom: 1rem; text-align: left; background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; color: #94a3b8;">
            <strong style="color: #cbd5e1; display: block; margin-bottom: 0.25rem;">Terms & Conditions:</strong>
            <div style="white-space: pre-line;">${escapeHtml(business.terms.replace(/\\n/g, '\n'))}</div>
          </div>
          ` : ''}
          <p style="margin: 0 0 0.5rem 0;">This is an automated receipt for your transaction. Thank you for your business!</p>
          <p style="margin: 0; font-weight: 600; color: #94a3b8;">InvoiceGST Professional Billing System</p>
        </div>
      </div>
    </div>
  `;
}
