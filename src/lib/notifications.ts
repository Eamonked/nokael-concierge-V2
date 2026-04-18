/**
 * Sends a notification to the server-side Telegram endpoint.
 * @param message The message to send (HTML supported)
 */
export const sendTelegramNotification = async (message: string) => {
  try {
    const apiKey = import.meta.env.VITE_NOKAEL_API_KEY;
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-nokael-key': apiKey } : {}),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      console.error('Failed to send Telegram notification');
    }
  } catch (error) {
    console.error('Error calling notify API:', error);
  }
};

/**
 * Sanitizes strings for Telegram HTML parse mode.
 */
function esc(text: any): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formats a quote request for Telegram.
 */
export const formatQuoteNotification = (data: any) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
📦 <b>New Dispatch Booking</b>
<b>Tracking ID:</b> <code>${esc(data.tracking_id)}</code>

👤 <b>Client:</b> ${esc(data.name)}
📞 <b>Contact:</b> ${esc(data.phone)}

🚚 <b>Service:</b> ${esc(data.item_type)}
⚡ <b>Priority:</b> ${esc(data.urgency)}

📍 <b>Pickup:</b> ${esc(data.pickup_location)}
🏁 <b>Dropoff:</b> ${esc(data.delivery_location)}

<a href="${dashboardUrl}">Manage job in Dashboard</a>
  `.trim();
};

/**
 * Formats a business inquiry for Telegram.
 */
export const formatBusinessNotification = (data: any) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
🏢 <b>New Corporate Inquiry</b>

🏭 <b>Company:</b> ${esc(data.company_name)}
👤 <b>Person:</b> ${esc(data.contact_person)}
📞 <b>Phone:</b> ${esc(data.phone_whatsapp)}
✉️ <b>Email:</b> ${esc(data.email)}
📊 <b>Volume:</b> ${esc(data.estimated_monthly_volume || 'N/A')}

<a href="${dashboardUrl}">Review Business Lead</a>
  `.trim();
};

/**
 * Formats a driver application for Telegram.
 */
export const formatDriverNotification = (data: any) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
🚛 <b>New Fleet Applicant</b>

👤 <b>Driver:</b> ${esc(data.full_name)}
📍 <b>Base:</b> ${esc(data.base_location)}
🚐 <b>Vehicle:</b> ${esc(data.vehicle_type)}
📞 <b>Phone:</b> ${esc(data.phone)}

<a href="${dashboardUrl}">Verify Onboarding Docs</a>
  `.trim();
};

/**
 * Formats a status update for Telegram.
 */
export const formatStatusUpdateNotification = (name: string, status: string) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
🔄 <b>Dispatch Status Updated</b>

👤 <b>Client:</b> ${esc(name)}
📈 <b>New Status:</b> ${esc(status.replace('_', ' ').toUpperCase())}

<a href="${dashboardUrl}">View Updates</a>
  `.trim();
};
