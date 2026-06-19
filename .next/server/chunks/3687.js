"use strict";exports.id=3687,exports.ids=[3687],exports.modules={7276:(e,t,r)=>{r.d(t,{Bd:()=>c,XP:()=>s,Fw:()=>d});var o=r(5245);let i=process.env.SMTP_HOST,n=parseInt(process.env.SMTP_PORT||"587"),a=process.env.SMTP_USER,l=process.env.SMTP_PASS,s=process.env.SMTP_FROM||a,d=null;async function c(e,t="",o=!1){try{let{getInvoiceById:i,getBusinessConfig:n,generateShareToken:a,getDb:l}=await Promise.resolve().then(r.bind(r,8224)),{getStateName:c,formatNumber:g,formatDateDisplay:m,escapeHtml:p}=await r.e(6659).then(r.bind(r,6659));try{let t=l();await t.collection("invoices").doc(e.toString()).update({email_status:"sending"})}catch(e){console.error("Failed to update email status to 'sending' in Firestore:",e)}let b=await i(e);if(!b){console.error(`[Mailer] Invoice with ID ${e} not found.`);try{let t=l();await t.collection("invoices").doc(e.toString()).update({email_status:"failed",email_error:"Invoice document not found in DB"})}catch(e){}return!1}let f=await n();if(!(f?.send_emails!==!1)){console.log(`✉️ [BACKGROUND MAIL] Email sending is disabled in business settings. Skipping invoice ${b.invoice_number}.`);try{let t=l();await t.collection("invoices").doc(e.toString()).update({email_status:"disabled"})}catch(e){}return!0}let u=await a(e),y=u&&t?`${t}/share/${u}`:null,h=(b.buyer_email||"").trim(),v=h&&h.includes("@")?h:s;console.log(`✉️ [BACKGROUND MAIL] Sending invoice ${b.invoice_number} to ${v} (CC: ${s}, isUpdate: ${o})`);let x="";b.items&&b.items.length>0&&b.items.forEach((e,t)=>{let r=(e.qty||1)*(e.rate||0),o=(e.discount_percent||0)/100*r,i=r-o,n=i+(e.gst_rate||18)/100*i;x+=`
          <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); font-size: 0.85rem;">
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${t+1}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1;">
              ${p(e.description)}
              ${e.qty_per_unit&&e.qty_per_unit>1?`<br/><small style="color: #64748b; font-size: 0.75rem;">(Qty/Unit: ${e.qty_per_unit})</small>`:""}
            </td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${e.hsn_sac||"—"}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${e.qty} ${e.unit||"Nos"}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: right;">₹${g(e.rate)}</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${e.discount_percent||0}%</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: center;">${e.gst_rate||18}%</td>
            <td style="padding: 0.6rem 0.5rem; color: #cbd5e1; text-align: right;">₹${g(n)}</td>
          </tr>
        `});let $=f?.name||"Seller Business",w=o?"[Updated] ":"",_=function({invoice:e,business:t,itemsHtml:r,shareUrl:o,actionText:i,isUpdate:n,businessName:a,escapeHtml:l,getStateName:s,formatNumber:d,formatDateDisplay:c}){return`
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
                ${n?"Revised Invoice":"Tax Invoice"}
              </span>
            </td>
          </tr>
        </table>

        <!-- Intro -->
        <div style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.25rem; font-weight: 600; color: #ffffff; margin: 0 0 0.5rem 0;">Dear ${l(e.buyer_name||"Customer")},</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin: 0;">
            A tax invoice has been ${i} for your recent transaction. Please find the details of your invoice below.
          </p>
        </div>

        <!-- Key Info Cards Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.05); padding: 1rem;">
          <tr>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Invoice Number</span>
              <strong style="color: #ffffff; font-size: 1rem;">${e.invoice_number}</strong>
            </td>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Invoice Date</span>
              <strong style="color: #ffffff; font-size: 1rem;">${c(e.invoice_date)}</strong>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Due Date</span>
              <strong style="color: #ffffff; font-size: 1rem;">${e.due_date?c(e.due_date):"On Receipt"}</strong>
            </td>
            <td style="width: 50%; padding: 1rem; vertical-align: top;">
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.25rem;">Grand Total</span>
              <strong style="color: #38bdf8; font-size: 1.1rem;">₹${d(e.grand_total)}</strong>
            </td>
          </tr>
        </table>

        <!-- Parties Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
          <tr>
            <td style="width: 48%; vertical-align: top;">
              <div style="font-size: 0.8rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Seller Details</div>
              <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
                <strong style="color: #ffffff; display: block; margin-bottom: 0.25rem;">${l(a)}</strong>
                ${t?.address?`${l(t.address)}<br/>`:""}
                ${t?.state_code?`${s(t.state_code)}<br/>`:""}
                <strong>GSTIN:</strong> ${t?.gstin||"N/A"}
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%; vertical-align: top; border-left: 1px solid rgba(148, 163, 184, 0.1); padding-left: 1.25rem;">
              <div style="font-size: 0.8rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Billing Details</div>
              <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
                <strong style="color: #ffffff; display: block; margin-bottom: 0.25rem;">${l(e.buyer_name)}</strong>
                ${e.buyer_address?`${l(e.buyer_address)}<br/>`:""}
                ${e.buyer_state?`${s(e.buyer_state)}<br/>`:""}
                ${e.buyer_phone?`📞 ${e.buyer_phone}<br/>`:""}
                ${e.buyer_gstin?`<strong>GSTIN:</strong> ${e.buyer_gstin}`:""}
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
              ${r}
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
                  <td style="padding: 0.5rem 0; text-align: right;">₹${d(e.subtotal)}</td>
                </tr>
                ${e.total_discount>0?`
                <tr>
                  <td style="padding: 0.5rem 0; color: #ef4444;">Discount:</td>
                  <td style="padding: 0.5rem 0; text-align: right; color: #ef4444;">−₹${d(e.total_discount)}</td>
                </tr>
                `:""}
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">Taxable Amount:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${d(e.taxable_amount)}</td>
                </tr>
                ${"intra"===e.supply_type?`
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">CGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${d(e.cgst)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">SGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${d(e.sgst)}</td>
                </tr>
                `:`
                <tr>
                  <td style="padding: 0.5rem 0; color: #94a3b8;">IGST:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">₹${d(e.igst)}</td>
                </tr>
                `}
                <tr style="border-top: 1px solid rgba(148, 163, 184, 0.2); font-weight: 700; font-size: 1rem; color: #ffffff;">
                  <td style="padding: 0.75rem 0; color: #38bdf8;">Grand Total:</td>
                  <td style="padding: 0.75rem 0; text-align: right; color: #38bdf8;">₹${d(e.grand_total)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        ${o?`
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <a href="${o}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 0.9rem 2.25rem; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);">
            View Invoice Online
          </a>
        </div>
        `:""}

        <!-- Footer & Terms -->
        <div style="border-top: 1px solid rgba(148, 163, 184, 0.1); padding-top: 1.5rem; text-align: center; font-size: 0.75rem; color: #64748b; line-height: 1.5;">
          ${t?.terms?`
          <div style="margin-bottom: 1rem; text-align: left; background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; color: #94a3b8;">
            <strong style="color: #cbd5e1; display: block; margin-bottom: 0.25rem;">Terms & Conditions:</strong>
            <div style="white-space: pre-line;">${l(t.terms.replace(/\\n/g,"\n"))}</div>
          </div>
          `:""}
          <p style="margin: 0 0 0.5rem 0;">This is an automated receipt for your transaction. Thank you for your business!</p>
          <p style="margin: 0; font-weight: 600; color: #94a3b8;">InvoiceGST Professional Billing System</p>
        </div>
      </div>
    </div>
  `}({invoice:b,business:f,itemsHtml:x,shareUrl:y,actionText:o?"updated":"generated",isUpdate:o,businessName:$,escapeHtml:p,getStateName:c,formatNumber:g,formatDateDisplay:m}),S={from:`"${$}" <${s}>`,to:v,cc:s,subject:`${w}Tax Invoice ${b.invoice_number} from ${$}`,html:_};if(d){await d.sendMail(S),console.log(`✉️ [BACKGROUND MAIL] Success! Invoice ${b.invoice_number} sent to ${v}.`);try{let t=l();await t.collection("invoices").doc(e.toString()).update({email_status:"sent",email_sent_at:new Date().toISOString()})}catch(e){}}else{console.log(`✉️ [BACKGROUND MAIL] SMTP not configured. Logged preview values:`),console.log(`  - From: ${S.from}`),console.log(`  - To: ${S.to}`),console.log(`  - CC: ${S.cc}`),console.log(`  - Subject: ${S.subject}`),y&&console.log(`  - Online Link: ${y}`);try{let t=l();await t.collection("invoices").doc(e.toString()).update({email_status:"not_configured",email_sent_at:new Date().toISOString()})}catch(e){}}return!0}catch(t){console.error(`❌ [BACKGROUND MAIL] Failed to send invoice email:`,t);try{let{logErrorToDb:o,getDb:i}=await Promise.resolve().then(r.bind(r,8224));await o(`lib/mailer.js (sendInvoiceEmail #${e})`,t.message,t.stack);let n=i();await n.collection("invoices").doc(e.toString()).update({email_status:"failed",email_error:t.message})}catch(e){}return!1}}i&&a&&l?(d=o.createTransport({host:i,port:n,secure:465===n,auth:{user:a,pass:l}}),console.log(`✉️ Nodemailer SMTP transporter initialized with host: ${i}`)):console.log(`⚠️ SMTP environment variables not configured. Reset links will be logged to the server console.`)},5279:(e,t,r)=>{r.d(t,{Gg:()=>d,KY:()=>c,RA:()=>m,SO:()=>g});var o=r(1615),i=r(4770),n=r.n(i);let a="aes-256-gcm",l="invoice-gst-session";function s(e){return n().createHash("sha256").update(e).digest()}async function d(){let e=await (0,o.cookies)(),t=e.get(l)?.value;if(!t)return null;let r=function(e,t){try{let{iv:r,t:o,e:i}=JSON.parse(e),l=s(t),d=n().createDecipheriv(a,l,Buffer.from(r,"hex"));d.setAuthTag(Buffer.from(o,"hex"));let c=d.update(i,"hex","utf8");return c+=d.final("utf8")}catch(e){return null}}(t,process.env.SESSION_SECRET||"invoice-gst-session-secret-key-12345");if(!r)return null;try{return JSON.parse(r)}catch(e){return null}}async function c(e){let t=process.env.SESSION_SECRET||"invoice-gst-session-secret-key-12345",r=function(e,t){let r=s(t),o=n().randomBytes(12),i=n().createCipheriv(a,r,o),l=i.update(e,"utf8","hex");l+=i.final("hex");let d=i.getAuthTag();return JSON.stringify({iv:o.toString("hex"),t:d.toString("hex"),e:l})}(JSON.stringify(e),t);(await (0,o.cookies)()).set(l,r,{httpOnly:!0,secure:!0,sameSite:"lax",maxAge:86400,path:"/"})}async function g(){(await (0,o.cookies)()).delete(l)}async function m(e=[]){let t=await d();return t?e.length>0&&!e.includes(t.role)?{error:"Access denied. Privileges required.",status:403}:{session:t}:{error:"Authentication required",status:401}}}};