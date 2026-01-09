//--------------------------------------------
// CONFIG - APNE REAL VALUES YAHI LAGAO
//--------------------------------------------
process.env.RAZORPAY_KEY = "rzp_test_xxxxx"; // Apni Razorpay Key ID
process.env.RAZORPAY_SECRET = "xxxxx";       // Apni Razorpay Secret
process.env.FIREBASE_URL = "https://yourproject-default-rtdb.firebaseio.com"; // Tera Firebase Realtime DB URL

//--------------------------------------------
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());

// RAZORPAY INSTANCE
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET
});

//--------------------------------------------
// CREATE ORDER
//--------------------------------------------
app.post("/create-order", async (req, res) => {
    try {
        const { amount, uid } = req.body;

        if (!amount || amount <= 0 || !uid) {
            return res.status(400).json({ error: "Invalid request" });
        }

        const options = {
            amount: amount * 100, // paise me
            currency: "INR",
            receipt: `order_${uid}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json(order);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Order creation failed" });
    }
});

//--------------------------------------------
// VERIFY PAYMENT + UPDATE WALLET
//--------------------------------------------
app.post("/verify-payment", async (req, res) => {
    try {
        const { order_id, payment_id, signature, uid, amount } = req.body;

        if (!order_id || !payment_id || !signature || !uid || !amount) {
            return res.status(400).json({ status: "failed", msg: "Missing fields" });
        }

        // 1️⃣ Signature verify
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET);
        hmac.update(order_id + "|" + payment_id);
        const generated_signature = hmac.digest("hex");

        if (generated_signature !== signature) {
            return res.json({ status: "failed", msg: "Signature mismatch" });
        }

        // 2️⃣ Update wallet in Firebase Realtime DB
        const walletRef = `${process.env.FIREBASE_URL}/wallets/${uid}.json`;

        // Pehle existing balance le lo
        const currentData = await axios.get(walletRef);
        let currentBalance = 0;
        if (currentData.data && currentData.data.balance) {
            currentBalance = currentData.data.balance;
        }

        // Update balance
        await axios.put(walletRef, {
            balance: currentBalance + Number(amount),
            lastUpdate: Date.now()
        });

        res.json({ status: "success" });

    } catch (err) {
        console.log(err);
        res.json({ status: "failed", msg: "Server error" });
    }
});

//--------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
