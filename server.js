import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";

const app = express();
app.use(express.json());

// -----------------------------------
// FIREBASE ADMIN INITIALIZE
// -----------------------------------
// Yahan apna Firebase service account JSON daal
const serviceAccount = {
  "type": "service_account",
  "project_id": "sathimere-415fa",
  "private_key_id": "XXXX",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@yourproject.iam.gserviceaccount.com",
  "client_id": "1234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sathimere-415fa-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// -----------------------------------
// RAZORPAY INSTANCE
// -----------------------------------
const razorpay = new Razorpay({
    key_id: "rzp_live_S0WmjPxxVh7JKJ",
    key_secret: "YOUR_RAZORPAY_SECRET"
});

// -----------------------------------
// CREATE ORDER
// -----------------------------------
app.post("/create-order", async (req, res) => {
    try {
        const { amount, uid } = req.body;
        const options = {
            amount: amount * 100, // paise
            currency: "INR",
            receipt: `receipt_${Date.now()}_${uid}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Order creation failed" });
    }
});

// -----------------------------------
// VERIFY PAYMENT
// -----------------------------------
app.post("/verify-payment", async (req, res) => {
    try {
        const { payment_id, order_id, signature, uid, amount } = req.body;

        // Signature verification
        const generated_signature = crypto.createHmac('sha256', razorpay.key_secret)
            .update(order_id + "|" + payment_id)
            .digest('hex');

        if (generated_signature !== signature) {
            return res.json({ status: "failed", msg: "Signature mismatch" });
        }

        // Fetch existing wallet balance
        const walletRef = db.ref("wallets/" + uid);
        const snapshot = await walletRef.once("value");
        let currentBalance = 0;
        if (snapshot.exists()) {
            currentBalance = snapshot.val().balance || 0;
        }

        // Update wallet balance
        await walletRef.update({
            balance: currentBalance + Number(amount),
            lastUpdate: Date.now()
        });

        // Save transaction to prevent duplicates
        const txnRef = db.ref("transactions/" + payment_id);
        await txnRef.set({
            uid,
            amount,
            order_id,
            payment_id,
            addedAt: Date.now()
        });

        res.json({ status: "success" });

    } catch (err) {
        console.log(err);
        res.json({ status: "failed", msg: "Server error" });
    }
});

// -----------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
