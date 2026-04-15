/**
 * Sends a notification to the server-side Telegram endpoint.
 * @param message The message to send (HTML supported)
 */
export const sendTelegramNotification = async (message: string) => {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
 * Formats a quote request for Telegram.
 */
export const formatQuoteNotification = (data: any) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
🚨 <b>New Quote Request</b>

<b>Customer:</b> ${data.name}
<b>Phone:</b> ${data.phone}
<b>Type:</b> ${data.item_type}
<b>Urgency:</b> ${data.urgency}
<b>Route:</b> ${data.pickup_location} ➔ ${data.delivery_location}

<a href="${dashboardUrl}">Open Dashboard</a>
  `.trim();
};

/**
 * Formats a business inquiry for Telegram.
 */
export const formatBusinessNotification = (data: any) => {
  const dashboardUrl = `${window.location.origin}/login`;
  return `
🏢 <b>New Business Inquiry</b>

<b>Company:</b> ${data.company_name}
<b>Contact:</b> ${data.contact_person}
<b>Phone:</b> ${data.phone_whatsapp}
<b>Email:</b> ${data.email}
<b>Volume:</b> ${data.estimated_monthly_volume || 'N/A'}

<a href="${dashboardUrl}">Open Dashboard</a>
  `.trim();
};
