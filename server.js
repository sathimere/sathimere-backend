const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
require("dotenv").config();

const admin = require("firebase-admin");

// -----------------------------------------------
// 🔥 FIREBASE ADMIN INITIALIZE
// -----------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

// -----------------------------------------------
const app = express();
app.use(express.json());
app.use(cors());

// -----------------------------------------------
// 🔥 RAZORPAY INSTANCE
// -----------------------------------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// ===============================================
// 1️⃣  CREATE ORDER  (same as before, untouched)
// ===============================================
app.post("/create-order", async (req, res) => {
  try {
    const { amount, uid } = req.body;
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}_${uid}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ===============================================
// 2️⃣  VERIFY PAYMENT + UPDATE WALLET  (MAIN FIX)
// ===============================================
app.post("/verify-payment", async (req, res) => {
  try {
    const { payment_id, uid, amount } = req.body;

    if (!payment_id || !uid || !amount) {
      return res.json({ success: false, msg: "Missing fields" });
    }

    // -------------------------------
    // 🔥 Step 1: FETCH PAYMENT DETAILS
    // -------------------------------
    const paymentData = await razorpay.payments.fetch(payment_id);

    if (!paymentData || paymentData.status !== "captured") {
      return res.json({ success: false, msg: "Payment not captured" });
    }

    // -------------------------------
    // 🔥 Step 2: AMOUNT VERIFY
    // -------------------------------
    if (paymentData.amount !== amount * 100) {
      return res.json({ success: false, msg: "Amount mismatch" });
    }

    // -------------------------------
    // 🔥 Step 3: DUPLICATE CHECK
    // -------------------------------
    const txnRef = db.collection("transactions").doc(payment_id);
    const txnSnap = await txnRef.get();

    if (txnSnap.exists) {
      return res.json({ success: true, msg: "Already updated" });
    }

    // -------------------------------
    // 🔥 Step 4: UPDATE WALLET BALANCE
    // -------------------------------
    const walletRef = db.collection("wallets").doc(uid);

    await walletRef.update({
      balance: admin.firestore.FieldValue.increment(amount)
    });

    // -------------------------------
    // 🔥 Step 5: SAVE TXN TO STOP DUPLICATES
    // -------------------------------
    await txnRef.set({
      uid,
      amount,
      paymentId: payment_id,
      addedAt: Date.now()
    });

    return res.json({ success: true });

  } catch (err) {
    console.log(err);
    return res.json({ success: false, msg: "Server Error" });
  }
});

// ===============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
