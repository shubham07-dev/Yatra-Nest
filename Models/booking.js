const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
     amount: {
        days: { type: Number, required: true },
        baseCost: { type: Number, required: true },
        gst: { type: Number, required: true },
        totalCost: { type: Number, required: true }
    }, // total cost (calculated from utils)
    paymentStatus: { 
        type: String, 
        enum: ["pending", "paid"], 
        default: "pending" 
    },
    screenshot: { type: String }, // store filename of uploaded screenshot
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Booking", bookingSchema);