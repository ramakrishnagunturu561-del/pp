import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Send an email notification for a document deadline
 */
export async function sendDeadlineEmail(to: string, docTitle: string, dueDate: string) {
  // Use SMTP settings from .env or fallback to Ethereal for testing
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  let transporter;

  if (user && pass) {
    // Live SMTP (e.g., Gmail, Outlook)
    transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this or use host/port
      auth: { user, pass }
    });
  } else {
    // Fallback to test account if no credentials provided
    console.log('No email credentials found in .env. Using Ethereal test account.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  const mailOptions = {
    from: '"Aurora Doc Classifier" <notifications@aurora.ai>',
    to: to,
    subject: `📅 Action Required: Deadline for ${docTitle}`,
    text: `Hello,\n\nThis is a reminder from your Document Classifier. The document "${docTitle}" has an upcoming deadline on ${dueDate}.\n\nPlease review it at your earliest convenience.\n\nBest regards,\nAurora.ai`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">📅 Deadline Reminder</h2>
        <p>Hello,</p>
        <p>This is a reminder that the document <strong>"${docTitle}"</strong> has an upcoming deadline:</p>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong style="color: #ef4444;">Due Date: ${dueDate}</strong>
        </div>
        <p>Please take any necessary actions before this date.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8rem; color: #6b7280;">Sent via Aurora Document Classifier</p>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent: %s', info.messageId);
  
  if (!user || !pass) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return { success: true, messageId: info.messageId, preview: nodemailer.getTestMessageUrl(info) };
  }

  return { success: true, messageId: info.messageId };
}
