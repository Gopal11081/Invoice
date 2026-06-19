import 'server-only';
import nodemailer from 'nodemailer';
import { getInvoiceEmailHtml } from './email-templates/invoice';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

let transporter = null;
if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  console.log(`✉️ Nodemailer SMTP transporter initialized with host: ${smtpHost}`);
} else {
  console.log(`⚠️ SMTP environment variables not configured. Reset links will be logged to the server console.`);
}

export { transporter, smtpFrom };

export async function sendInvoiceEmail(invoiceId, origin = '', isUpdate = false) {
  try {
    const { getInvoiceById, getBusinessConfig, generateShareToken, getDb } = await import('./db');
    const { getStateName, formatNumber, formatDateDisplay, escapeHtml } = await import('../utils');

    // Update status to 'sending' in DB
    try {
      const db = getDb();
      await db.collection('invoices').doc(invoiceId.toString()).update({
        email_status: 'sending'
      });
    } catch (dbErr) {
      console.error("Failed to update email status to 'sending' in Firestore:", dbErr);
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      console.error(`[Mailer] Invoice with ID ${invoiceId} not found.`);
      try {
        const db = getDb();
        await db.collection('invoices').doc(invoiceId.toString()).update({
          email_status: 'failed',
          email_error: 'Invoice document not found in DB'
        });
      } catch (_) {}
      return false;
    }

    const business = await getBusinessConfig();
    const sendEmailsEnabled = business?.send_emails !== false;

    if (!sendEmailsEnabled) {
      console.log(`✉️ [BACKGROUND MAIL] Email sending is disabled in business settings. Skipping invoice ${invoice.invoice_number}.`);
      try {
        const db = getDb();
        await db.collection('invoices').doc(invoiceId.toString()).update({
          email_status: 'disabled'
        });
      } catch (_) {}
      return true;
    }

    const shareToken = await generateShareToken(invoiceId);
    const shareUrl = shareToken && origin ? `${origin}/share/${shareToken}` : null;

    const customerEmail = (invoice.buyer_email || '').trim();
    const hasCustomerEmail = customerEmail && customerEmail.includes('@');
    const recipient = hasCustomerEmail ? customerEmail : smtpFrom;

    console.log(`✉️ [BACKGROUND MAIL] Sending invoice ${invoice.invoice_number} to ${recipient} (CC: ${smtpFrom}, isUpdate: ${isUpdate})`);

    let itemsHtml = '';
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, idx) => {
        const gross = (item.qty || 1) * (item.rate || 0);
        const discAmt = gross * ((item.discount_percent || 0) / 100);
        const taxable = gross - discAmt;
        const rowTotal = taxable + (taxable * ((item.gst_rate || 18) / 100));
        
        itemsHtml += `
          <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); font-size: 0.85rem;">
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${idx + 1}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1;">
              ${escapeHtml(item.description)}
              ${item.qty_per_unit && item.qty_per_unit > 1 ? `<br/><small style="color: #64748b; font-size: 0.75rem;">(Qty/Unit: ${item.qty_per_unit})</small>` : ''}
            </td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${item.hsn_sac || '—'}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${item.qty} ${item.unit || 'Nos'}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: right;">₹${formatNumber(item.rate)}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${item.discount_percent || 0}%</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${item.gst_rate || 18}%</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: right;">₹${formatNumber(rowTotal)}</td>
          </tr>
        `;
      });
    }

    const businessName = business?.name || 'Seller Business';
    const actionText = isUpdate ? 'updated' : 'generated';
    const subjectPrefix = isUpdate ? '[Updated] ' : '';

    const html = getInvoiceEmailHtml({
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
    });

    const mailOptions = {
      from: `"${businessName}" <${smtpFrom}>`,
      to: recipient,
      cc: smtpFrom,
      subject: `${subjectPrefix}Tax Invoice ${invoice.invoice_number} from ${businessName}`,
      html
    };

    if (transporter) {
      await transporter.sendMail(mailOptions);
      console.log(`✉️ [BACKGROUND MAIL] Success! Invoice ${invoice.invoice_number} sent to ${recipient}.`);
      try {
        const db = getDb();
        await db.collection('invoices').doc(invoiceId.toString()).update({
          email_status: 'sent',
          email_sent_at: new Date().toISOString()
        });
      } catch (_) {}
    } else {
      console.log(`✉️ [BACKGROUND MAIL] SMTP not configured. Logged preview values:`);
      console.log(`  - From: ${mailOptions.from}`);
      console.log(`  - To: ${mailOptions.to}`);
      console.log(`  - CC: ${mailOptions.cc}`);
      console.log(`  - Subject: ${mailOptions.subject}`);
      if (shareUrl) {
        console.log(`  - Online Link: ${shareUrl}`);
      }
      try {
        const db = getDb();
        await db.collection('invoices').doc(invoiceId.toString()).update({
          email_status: 'not_configured',
          email_sent_at: new Date().toISOString()
        });
      } catch (_) {}
    }
    return true;
  } catch (err) {
    console.error(`❌ [BACKGROUND MAIL] Failed to send invoice email:`, err);
    try {
      const { logErrorToDb, getDb } = await import('./db');
      await logErrorToDb(`lib/mailer.js (sendInvoiceEmail #${invoiceId})`, err.message, err.stack);
      const db = getDb();
      await db.collection('invoices').doc(invoiceId.toString()).update({
        email_status: 'failed',
        email_error: err.message
      });
    } catch (_) {}
    return false;
  }
}
