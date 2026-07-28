const QRCode = require("qrcode");

/**
 * Generates a QR code (as a base64 data URL) that points the customer's
 * phone browser to that specific table's digital menu.
 * The qrToken is a unique, unguessable UUID stored on the table row —
 * scanning it resolves directly to restaurant + table, no login needed.
 */
async function generateTableQR(clientUrl, qrToken) {
  const menuUrl = `${clientUrl}/menu/${qrToken}`;
  const dataUrl = await QRCode.toDataURL(menuUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#14171C", light: "#FFFFFF" },
  });
  return { menuUrl, dataUrl };
}

module.exports = { generateTableQR };
