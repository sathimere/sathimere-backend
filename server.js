const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// Create Order
app.post("/create-order", async (req, res) => {
  try {
    const { amount, uid } = req.body;
    const options = {
      amount: amount * 100, // in paise
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

// Verify Payment
app.post("/verify-payment", async (req, res) => {
  try {
    const { payment_id, order_id, uid, amount } = req.body;
    // optional: signature verification can be added here
    res.json({ status: "success" });
  } catch (err) {
    console.log(err);
    res.json({ status: "failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
