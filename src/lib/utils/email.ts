// ============================================================
// Email Utility — Settlement Notifications & Contract Renewals
// Uses Resend API. If RESEND_API_KEY is not configured, falls back to console.log.
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@yourcompany.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================================
// Settlement Emails
// ============================================================

export interface SettlementEmailData {
  employeeName: string;
  employeeCode: string;
  settlementDate: string;
  netTotal: number;
  pdfUrl: string;
  processedByName: string;
  reason: string;
  companyName?: string;
  toEmail?: string;
}

/**
 * Send settlement confirmation email.
 */
export async function sendSettlementConfirmationEmail(data: SettlementEmailData): Promise<void> {
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
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'HR & Payroll System'}</p>
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
          © ${new Date().getFullYear()} — ${data.companyName || 'HR & Payroll System'}
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
          <p style="margin: 4px 0 0; opacity: 0.8;">HR & Payroll System</p>
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
          © ${new Date().getFullYear()} — HR & Payroll System
        </div>
      </body>
    </html>
  `;

  const textBody = `
Welcome to the HR & Payroll System, ${fullName}!

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

// ============================================================
// Contract Renewal Emails
// ============================================================

export interface ContractRenewalEmailData {
  employeeName: string;
  employeeCode: string;
  renewalId: string;
  signingLink: string;
  companyName?: string;
  toEmail?: string;
  initiatedByName?: string;
  grossSalary: number;
  renewalPeriodYears: number;
}

/**
 * Send email to employee notifying them of a contract renewal request.
 */
export async function sendContractRenewalRequestEmail(data: ContractRenewalEmailData): Promise<void> {
  const subject = `Contract Renewal Request — ${data.employeeName} (${data.employeeCode})`;

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
          .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; margin: 16px 0; }
          .highlight strong { color: #92400e; }
          .btn { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: 600; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
          .note { font-size: 12px; color: #6b7280; margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Contract Renewal Request</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'HR & Payroll System'}</p>
        </div>
        <div class="content">
          <p>Dear <strong>${data.employeeName}</strong>,</p>
          <p>Your contract renewal has been initiated by ${data.initiatedByName || 'HR'}. Please review the updated terms and sign digitally using the link below.</p>

          <div class="highlight">
            <strong>Renewal Summary:</strong><br />
            Renewal Period: ${data.renewalPeriodYears} year(s)<br />
            New Gross Salary: ${data.grossSalary.toFixed(3)} OMR
          </div>

          <p>
            <a href="${data.signingLink}" class="btn" target="_blank" rel="noopener">
              Sign Contract Renewal
            </a>
          </p>

          <div class="note">
            <strong>Important:</strong> This link is secure and unique to you. Please complete the signing within 30 days. If you have any questions, contact the HR department.
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — ${data.companyName || 'HR & Payroll System'}
        </div>
      </body>
    </html>
  `;

  const textBody = `
Contract Renewal Request — ${data.employeeName} (${data.employeeCode})

Your contract renewal has been initiated.

Renewal Period: ${data.renewalPeriodYears} year(s)
New Gross Salary: ${data.grossSalary.toFixed(3)} OMR

Sign here: ${data.signingLink}

This link is secure and unique to you. Please complete within 30 days.
  `;

  if (!RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured. Would send renewal request email to:', data.toEmail || 'employee@company.com');
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
      console.error('[Email] Failed to send renewal request email:', response.status, errorData);
    } else {
      console.log('[Email] Contract renewal request email sent to:', data.toEmail || 'hr@company.com');
    }
  } catch (error) {
    console.error('[Email] Error sending renewal request email:', error);
  }
}

/**
 * Send email to HR notifying that employee has signed the renewal.
 */
export async function sendContractSignedNotificationEmail(data: {
  employeeName: string;
  employeeCode: string;
  renewalId: string;
  companyName?: string;
  toEmail?: string;
}): Promise<void> {
  const subject = `Contract Signed — ${data.employeeName} (${data.employeeCode})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
          .btn { display: inline-block; background: #1e293b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Contract Signed</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'HR & Payroll System'}</p>
        </div>
        <div class="content">
          <p>The employee has signed their contract renewal:</p>
          <ul>
            <li><strong>Employee:</strong> ${data.employeeName} (${data.employeeCode})</li>
          </ul>
          <p>Please proceed with the approval workflow.</p>
          <a href="${APP_URL}/dashboard/contract-renewal/${data.renewalId}" class="btn">View in Dashboard</a>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — ${data.companyName || 'HR & Payroll System'}
        </div>
      </body>
    </html>
  `;

  if (!RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured. Would send signed notification email.');
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
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
      }),
    });
  } catch (error) {
    console.error('[Email] Error sending signed notification:', error);
  }
}

/**
 * Send email notification when renewal is approved by HR.
 */
export async function sendContractApprovedEmail(data: {
  employeeName: string;
  employeeCode: string;
  renewalPeriodYears: number;
  grossSalary: number;
  companyName?: string;
  toEmail?: string;
}): Promise<void> {
  const subject = `Contract Renewal Approved — ${data.employeeName} (${data.employeeCode})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
          .details { margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details th, .details td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          .details th { color: #6b7280; font-weight: 600; font-size: 13px; text-transform: uppercase; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Contract Renewal Approved</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'HR & Payroll System'}</p>
        </div>
        <div class="content">
          <p>Congratulations! Your contract renewal has been approved.</p>

          <div class="details">
            <table>
              <tr><th>Employee</th><td>${data.employeeName} (${data.employeeCode})</td></tr>
              <tr><th>Renewal Period</th><td>${data.renewalPeriodYears} year(s)</td></tr>
              <tr><th>New Gross Salary</th><td>${data.grossSalary.toFixed(3)} OMR</td></tr>
            </table>
          </div>

          <p>A copy of the signed contract will be available in your dashboard.</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — ${data.companyName || 'HR & Payroll System'}
        </div>
      </body>
    </html>
  `;

  if (!RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured. Would send approval email.');
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
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
      }),
    });
  } catch (error) {
    console.error('[Email] Error sending approval email:', error);
  }
}
