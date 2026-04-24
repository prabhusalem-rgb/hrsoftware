// ============================================================
// Email Utility — Settlement Notifications
// Final Settlement Redesign — Phase 3
// ============================================================
// Sends settlement confirmation emails using Resend API.
// If RESEND_API_KEY is not configured, falls back to console.log.
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@yourcompany.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface SettlementEmailData {
  employeeName: string;
  employeeCode: string;
  settlementDate: string;
  netTotal: number;
  pdfUrl: string;
  processedByName: string;
  reason: string;
  companyName?: string;
  toEmail?: string; // override recipient
}

/**
 * Send settlement confirmation email.
 * Uses Resend API if configured; otherwise logs to console.
 */
export async function sendSettlementConfirmationEmail(data: SettlementEmailData): Promise<void> {
  // Build email content
  const subject = `Final Settlement Processed — ${data.employeeName} (${data.employeeCode})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
          .details { margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details th, .details td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          .details th { color: #6b7280; font-weight: 600; font-size: 13px; text-transform: uppercase; }
          .total { font-size: 24px; font-weight: 700; color: #059669; margin-top: 20px; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
          .btn { display: inline-block; background: #1e293b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Final Settlement Statement</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'Bright Flowers HR & Payroll'}</p>
        </div>
        <div class="content">
          <p>A final settlement has been processed for the following employee:</p>

          <div class="details">
            <table>
              <tr><th>Employee</th><td>${data.employeeName} (${data.employeeCode})</td></tr>
              <tr><th>Settlement Date</th><td>${new Date(data.settlementDate).toLocaleDateString()}</td></tr>
              <tr><th>Reason</th><td style="text-transform: capitalize">${data.reason.replace('_', ' ')}</td></tr>
              <tr><th>Processed By</th><td>${data.processedByName}</td></tr>
            </table>
          </div>

          <p class="total">Net Settlement Amount: ${data.netTotal.toFixed(3)} OMR</p>

          <a href="${APP_URL}${data.pdfUrl}" class="btn" target="_blank" rel="noopener">
            View / Download PDF
          </a>

          <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">
            This is an automated notification from the HR & Payroll system.
            For any queries, please contact the HR department.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — ${data.companyName || 'Bright Flowers HR & Payroll'}
        </div>
      </body>
    </html>
  `;

  const textBody = `
Final Settlement Processed

Employee: ${data.employeeName} (${data.employeeCode})
Settlement Date: ${new Date(data.settlementDate).toLocaleDateString()}
Reason: ${data.reason.replace('_', ' ')}
Processed By: ${data.processedByName}

Net Settlement Amount: ${data.netTotal.toFixed(3)} OMR

View PDF: ${APP_URL}${data.pdfUrl}

---
This is an automated notification from the HR & Payroll system.
  `;

  // If no API key, log and exit
  if (!RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured. Would send email with subject:', subject);
    console.log('[Email] To:', data.toEmail || 'hr@company.com');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: data.toEmail ? [data.toEmail] : ['hr@company.com'],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send:', response.status, errorData);
    }
  } catch (error) {
    console.error('[Email] Error sending:', error);
  }
}

/**
 * Send welcome email to newly created users with their auto-generated password.
 */
export async function sendUserWelcomeEmail(email: string, password: string, fullName: string): Promise<void> {
  const subject = 'Welcome to the HR & Payroll System — Your Credentials';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
          .credentials { background: white; padding: 16px; border-radius: 6px; border: 1px dashed #cbd5e1; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
          .btn { display: inline-block; background: #1e293b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Welcome, ${fullName}</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">Bright Flowers HR & Payroll System</p>
        </div>
        <div class="content">
          <p>An account has been created for you. You can now log in to the HR & Payroll dashboard using the credentials below:</p>

          <div class="credentials">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Login Email:</p>
            <p style="margin: 4px 0 12px; font-weight: 600; font-size: 16px;">${email}</p>
            
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Temporary Password:</p>
            <p style="margin: 4px 0 0; font-weight: 600; font-size: 16px; font-family: monospace; letter-spacing: 1px;">${password}</p>
          </div>

          <p>For security reasons, we recommend changing your password immediately after your first login.</p>

          <a href="${APP_URL}/auth/login" class="btn">Login to Dashboard</a>

          <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">
            If you did not expect this email, please ignore it or contact your administrator.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — Bright Flowers HR & Payroll
        </div>
      </body>
    </html>
  `;

  const textBody = `
Welcome to Bright Flowers HR & Payroll, ${fullName}!

An account has been created for you.

Login Email: ${email}
Temporary Password: ${password}

Login here: ${APP_URL}/auth/login

Please change your password after your first login.
  `;

  if (!RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured. Welcome email details:');
    console.log('[Email] To:', email, '| Pass:', password);
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send welcome email:', response.status, errorData);
    }
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
  }
}
