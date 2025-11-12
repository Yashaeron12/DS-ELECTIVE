// services/emailService.js - Free email sharing
const nodemailer = require('nodemailer');

// Configure free email service (Gmail SMTP)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail
    pass: process.env.EMAIL_APP_PASSWORD // App-specific password
  }
});

const emailService = {
  async sendFileShare(recipientEmail, fileInfo, shareLink, senderName, message = '') {
    try {
      const emailTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f5f5f5; }
            .file-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .download-btn { 
              display: inline-block; 
              background: #1976d2; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 15px 0; 
            }
            .footer { padding: 20px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📁 File Shared with You</h2>
            </div>
            <div class="content">
              <p>Hi there!</p>
              <p><strong>${senderName}</strong> has shared a file with you on CloudCollab.</p>
              
              ${message ? `<p><em>"${message}"</em></p>` : ''}
              
              <div class="file-info">
                <h3>📄 ${fileInfo.fileName}</h3>
                <p><strong>Size:</strong> ${(fileInfo.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Type:</strong> ${fileInfo.mimeType}</p>
                ${fileInfo.description ? `<p><strong>Description:</strong> ${fileInfo.description}</p>` : ''}
              </div>
              
              <a href="${shareLink}" class="download-btn">📥 Download File</a>
              
              <p><small>This link will work for 24 hours. Download the file to save it permanently.</small></p>
            </div>
            <div class="footer">
              <p>Sent via CloudCollab - Collaborative Cloud Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const mailOptions = {
        from: `CloudCollab <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `📁 ${senderName} shared "${fileInfo.fileName}" with you`,
        html: emailTemplate
      };
      
      await transporter.sendMail(mailOptions);
      console.log('✅ File share email sent to:', recipientEmail);
      
    } catch (error) {
      console.error('❌ Error sending file share email:', error);
      throw error;
    }
  },
  
  async sendBulkFileShare(recipients, fileInfo, shareLink, senderName, message = '') {
    try {
      const sendPromises = recipients.map(email => 
        this.sendFileShare(email, fileInfo, shareLink, senderName, message)
      );
      
      await Promise.all(sendPromises);
      console.log(`✅ Bulk file share emails sent to ${recipients.length} recipients`);
      
    } catch (error) {
      console.error('❌ Error sending bulk file share emails:', error);
      throw error;
    }
  }
};

module.exports = emailService;