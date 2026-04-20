const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notifyValetsOnRetrieval = functions.firestore
  .document("tickets/{ticketId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when status changes to "retrieving"
    if (before.status === after.status) return null;
    if (after.status !== "retrieving") return null;

    const ticketNum = after.ticketNum || "??";
    const car = `${after.color || ""} ${after.car || ""}`.trim();
    const spot = after.spot || "—";
    const customerName = after.customerName || "";
    const date = after.date || "";

    // Get all valet tokens for today
    const tokensSnap = await admin.firestore()
      .collection("valetTokens")
      .where("date", "==", date)
      .get();

    if (tokensSnap.empty) {
      console.log("No valet tokens found for today");
      return null;
    }

    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) return null;

    const message = {
      notification: {
        title: `🔔 Car Requested — #${ticketNum}`,
        body: customerName ? `${customerName} · ${car} · Spot ${spot}` : `${car} · Spot ${spot}`,
      },
      data: {
        ticketNum,
        confirmCode: after.confirmCode || "",
      },
      tokens: uniqueTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Sent ${response.successCount} notifications`);
      return null;
    } catch (err) {
      console.error("Error sending notifications:", err);
      return null;
    }
  });
