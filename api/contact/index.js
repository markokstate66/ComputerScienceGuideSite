const { EmailClient } = require("@azure/communication-email");

module.exports = async function (context, req) {
  context.log('Contact form submission received');

  // Validate request
  if (!req.body) {
    context.res = {
      status: 400,
      body: { success: false, message: "Request body is required" }
    };
    return;
  }

  const { name, email, topic, message } = req.body;

  // Validate required fields
  if (!name || !email || !topic || !message) {
    context.res = {
      status: 400,
      body: { success: false, message: "All fields are required" }
    };
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    context.res = {
      status: 400,
      body: { success: false, message: "Invalid email format" }
    };
    return;
  }

  try {
    // Get connection string from environment
    const connectionString = process.env.ACS_CONNECTION_STRING;

    if (!connectionString) {
      context.log.error('ACS_CONNECTION_STRING not configured');
      context.res = {
        status: 500,
        body: { success: false, message: "Email service not configured" }
      };
      return;
    }

    const emailClient = new EmailClient(connectionString);

    // Prepare email content
    const emailMessage = {
      senderAddress: process.env.ACS_SENDER_EMAIL || "DoNotReply@feb1b99e-f855-4a7f-9d42-640a721a7083.azurecomm.net",
      content: {
        subject: `[CS Guide] ${topic} - from ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Name:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Topic:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(topic)}</td>
              </tr>
            </table>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Message:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This email was sent from the contact form at computerscienceguide.com
            </p>
          </div>
        `,
        plainText: `
New Contact Form Submission
===========================

Name: ${name}
Email: ${email}
Topic: ${topic}

Message:
${message}

---
Sent from computerscienceguide.com contact form
        `
      },
      recipients: {
        to: [{ address: process.env.CONTACT_EMAIL || "mark@stgengineer.com" }]
      }
    };

    // Send email
    const poller = await emailClient.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    context.log('Email sent successfully:', result.id, result.status);

    context.res = {
      status: 200,
      body: {
        success: true,
        message: "Thank you! Your message has been sent.",
        debug: {
          id: result.id,
          status: result.status,
          hasConnectionString: !!connectionString,
          recipient: process.env.CONTACT_EMAIL || "mark@stgengineer.com"
        }
      }
    };

  } catch (error) {
    context.log.error('Error sending email:', error);
    context.res = {
      status: 500,
      body: {
        success: false,
        message: "Failed to send message. Please try again later.",
        debug: {
          error: error.message,
          hasConnectionString: !!process.env.ACS_CONNECTION_STRING
        }
      }
    };
  }
};

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
