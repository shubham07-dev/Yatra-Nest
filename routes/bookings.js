if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const router = express.Router();
const Listing = require("../Models/listing");
const Booking = require("../Models/booking");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const Tesseract = require("tesseract.js");                // ✅ NEW
const moment = require("moment-timezone");                // ✅ NEW (timezone aware)
moment.tz.setDefault("Asia/Kolkata");
const {storage}=require("../cloudConfig.js");
const upload=multer({storage});

// // ---------- Multer setup (for screenshot uploads) ----------
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, "uploads/payments"),
//     filename: (req, file, cb) =>
//         cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
// });
// const upload = multer({ storage });

// ---------- Email transporter ----------
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false }
});

// ---------- helpers ----------
function normalize(s = "") {
    return s.toLowerCase().replace(/\s+/g, "");
}

function numberLikePatterns(n) {
    // handle `3540`, `3,540`, `3 540`, possible OCR merges
    const raw = String(n);
    const withCommas = n.toLocaleString("en-IN");
    const loose = withCommas.replace(/,/g, "[,\\s]?");
    return [
        new RegExp(`\\b${raw}\\b`),
        new RegExp(loose),
    ];
}

// try to find a date in the OCR text and parse it
function extractPaymentDate(text) {
    const candidates = [];
    const patterns = [
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g,           // 16/08/2025 or 16-08-2025
        /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,           // 2025/08/16
        /\b(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})\b/g,            // 16 Aug 2025
        /\b([A-Za-z]{3,}\s+\d{1,2},\s*\d{4})\b/g,           // Aug 16, 2025
    ];

    for (const re of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) candidates.push(m[1]);
    }

    const formats = ["DD/MM/YYYY", "D/M/YYYY", "DD-MM-YYYY", "YYYY/MM/DD", "YYYY-MM-DD", "DD MMM YYYY", "MMM DD, YYYY"];
    for (const c of candidates) {
        const parsed = moment.tz(c, formats, true, "Asia/Kolkata");
        if (parsed.isValid()) return parsed;
    }
    return null;
}

function withinAllowedWindow(paymentMoment) {
    // allow payment on "today" or "yesterday" (because OCR timezones / delays)
    const today = moment().startOf("day");
    const yday = moment().subtract(1, "day").startOf("day");
    return paymentMoment.isSame(today, "day") || paymentMoment.isSame(yday, "day");
}

// ---------- Show booking form ----------
router.get("/:id/book", async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).send("Listing not found");
    // 🔹 Fetch all bookings for this listing
    const bookings = await Booking.find({ listing: listing._id });

    let disabledDates = [];
    let today = new Date();

    bookings.forEach(b => {
        let start = new Date(b.startDate);
        let end = new Date(b.endDate);

        // ✅ Only disable if booking endDate >= today
        if (end >= today) {
            let temp = new Date(start);
            while (temp <= end) {
                disabledDates.push(temp.toISOString().split("T")[0]);
                temp.setDate(temp.getDate() + 1);
            }
        }
    });
    res.render("listing/bookingForm.ejs", { listing , disabledDates });
});

// ---------- Handle booking form → Show QR ----------
router.post("/:id/book", async (req, res) => {
    const { startDate, endDate, email, phone, agree } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing) return res.status(404).send("Listing not found");
    if (!agree) {
        req.flash("error", "You must agree to terms");
        return res.redirect(`/listing/${req.params.id}/book`);
    }

   // Check if dates overlap
    const overlappingBooking = await Booking.findOne({
        listing: listing._id,
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
        ]
    });
    if (overlappingBooking) {
        req.flash("error", "⚠ These dates are already booked");
        return res.redirect(`/listing/${req.params.id}/book`);
    }
    // ✅ Generate booked dates array
    let newDates = [];
    let start = new Date(startDate);
    let end = new Date(endDate);

    while (start <= end) {
        let d = start.toISOString().split("T")[0];
        newDates.push(d);
        start.setDate(start.getDate() + 1);
    }

    // Cost calculation
    const days = newDates.length;
    const baseCost = listing.price * days;
    const gst = Math.round(baseCost * 0.18);
    const totalCost = baseCost + gst;
    const amount = { days, baseCost, gst, totalCost };      // ✅ store structured

    const priceBreakdown = { days, baseCost, gst, totalCost, newDates };

    // Generate UPI QR (dynamic per owner)
    const upiId = listing.ownerUpiId;
    if (!upiId) {
        req.flash("error", "Host has not set up payments yet");
        return res.redirect(`/listing/${req.params.id}/book`);
    }
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(listing.title)}&am=${totalCost}&cu=INR&tn=Booking-${listing._id}`;
    const qrCodeDataURL = await QRCode.toDataURL(upiLink);

    // Save booking in session (unconfirmed)
    req.session.booking = {
        listingId: listing._id,
        startDate,
        endDate,
        email,
        phone,
        price: priceBreakdown,
        createdAt: Date.now(),                // ✅ full object
        newDates,              // ✅ needed for blocking later
        ownerUpiId: upiId      // ✅ for OCR check
    };

    res.render("listing/paymentPage.ejs", {
        listing,
        totalCost,
        qrCodeDataURL,
        startDate,
        endDate,
        upiId,
        priceBreakdown
    });
});

// ---------- Confirm booking with Screenshot Upload + OCR ----------
router.post("/:id/confirm", upload.single("paymentProof"), async (req, res) => {
    try {
        const booking = req.session?.booking;
        if (!booking) {
            req.flash("error", "No booking found");
            return res.redirect(`/listing/${req.params.id}/book`);
        }
        
       // ✅ populate owner from User
    const listing = await Listing.findById(booking.listingId).populate("owner");
    if (!listing) return res.status(404).send("Listing not found");
    // Check expiry (30 minutes validity)
    const EXPIRY_TIME = 5 * 60 * 1000;
    if (Date.now() - booking.createdAt > EXPIRY_TIME) {
        req.session.booking = null;
        req.flash("error", "⏰ Booking session expired. Please select dates again.");
        return res.redirect(`/listing/${req.params.id}/book`);
    }


        if (!req.file) {
            req.flash("error", "Please upload a payment screenshot");
            return res.redirect(`/listing/${listing._id}/book`);
        }

        // ---------- OCR the screenshot ----------
        const { data: { text } } = await Tesseract.recognize(req.file.path, "eng");
        const ocrRaw = text || "";
        const ocr = normalize(ocrRaw);

        // ---------- Verify UPI ID ----------
        const expectedUpi = normalize(booking.ownerUpiId || listing.ownerUpiId || "");
        const upiOk = expectedUpi && ocr.includes(expectedUpi);

        // ---------- Verify Amount ----------
        const amt = Number(booking.amount?.totalCost || 0);
        const amtOk = numberLikePatterns(amt).some((re) => re.test(ocrRaw));

        // ---------- Verify Date ----------
        const foundDate = extractPaymentDate(ocrRaw);
        const dateOk = foundDate ? withinAllowedWindow(foundDate) : false;

        // ---------- If any check fails → redirect to failed page ----------
        // ---------- If any check fails → redirect to failed page ----------
if (!(upiOk && amtOk && dateOk)) {
    let reasons = [];
    if (!upiOk) reasons.push("UPI ID did not match");
    if (!amtOk) reasons.push("Payment amount did not match");
    if (!dateOk) reasons.push("Payment date not recent");

    // 📧 Notify owner about failed payment
    if (listing.owner && listing.owner.email) {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: listing.owner.email,
            subject: "⚠️ Yatra-Nest Booking Payment Failed",
            text: `A booking attempt for "${listing.title}" from ${booking.startDate} to ${booking.endDate} failed.
Guest: ${booking.email} / ${booking.phone}
Reason: ${reasons.join(", ")}`,
            attachments: req.file ? [
                { filename: path.basename(req.file.path), path: req.file.path }
            ] : []
        });
    }

    return res.redirect(
        `/listing/${listing._id}/paymentFailed?reason=${encodeURIComponent(reasons.join(", "))}`
    );
}
        // ---------- All checks passed → Confirm booking ----------
        listing.bookedDates = [...(listing.bookedDates || []), ...booking.newDates];
        await listing.save();

        const confirmedBooking = new Booking({
            listing: listing._id,
            startDate: booking.startDate,
            endDate: booking.endDate,
            email: booking.email,
            phone: booking.phone,
            amount: {
            days: booking.price.days,
            baseCost: booking.price.baseCost,
            gst: booking.price.gst,
            totalCost: booking.price.totalCost
        },
            paymentStatus: "paid",
            paymentScreenshotPath: req.file.path
        });
        await confirmedBooking.save();

        // Send confirmation email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.email,
            subject: "Yatra-Nest Booking Confirmed ✅",
            text: `Your booking for "${listing.title}" is confirmed from ${booking.startDate} to ${booking.endDate}. Amount: ₹${booking.amount.totalCost}.`
        });
// console.log(listing.owner.email);
        // Notify host
        if (listing.owner && listing.owner.email)  {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: listing.owner.email,
                subject: "New Yatra-Nest Booking (Payment Verified) 💰",
                text: `New booking for "${listing.title}" from ${booking.startDate} to ${booking.endDate}.
Guest: ${booking.email} / ${booking.phone}
Amount: ₹${booking.amount.totalCost}`,
                attachments: [{ filename: path.basename(req.file.path), path: req.file.path }]
            });
        }

        // req.session.booking = null;
        res.render("listing/bookingSuccess.ejs", { listing, booking });
    } catch (err) {
        console.error(err);
        req.flash("error", "Something went wrong while verifying payment");
        res.redirect(`/listing/${req.params.id}/book`);
    }
    
});

router.get("/:id/paymentFailed", async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).send("Listing not found");

    const reason = req.query.reason || "Unknown error during payment verification";

    res.render("listing/paymentFailed.ejs", { listing, reason });
});





// // Show all pending bookings for owner
// router.get("/listing/pending", async (req, res) => {
//     const pending = await Booking.find({ paymentStatus: "pending" }).populate("listing");
//     res.render("owner/pendingBookings.ejs", { bookings: pending });
// });

// // Approve or Reject pending booking
// router.post("/listing/:bookingId/review", async (req, res) => {
//     const { action, message } = req.body; // action = "approve" or "reject"
//     const booking = await Booking.findById(req.params.bookingId).populate("listing");

//     if (!booking) {
//         req.flash("error", "Booking not found");
//         return res.redirect("/listing/pending");
//     }

//     if (action === "approve") {
//         booking.paymentStatus = "paid";

//         // mark dates in listing
//         booking.listing.bookedDates = [...(booking.listing.bookedDates || []), ...booking.listing.bookedDates];
//         await booking.listing.save();

//         await booking.save();

//         // Send success email to user
//         await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: "✅ Your Booking is Confirmed",
//             text: message || `Your booking for "${booking.listing.title}" is confirmed from ${booking.startDate} to ${booking.endDate}.`
//         });

//         req.flash("success", "Booking approved and guest notified");
//     } else {
//         booking.paymentStatus = "failed";
//         await booking.save();

//         // Send failure email to user
//         await transporter.sendMail({
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: "❌ Your Booking was Rejected",
//             text: message || `Sorry, your booking for "${booking.listing.title}" could not be confirmed.`
//         });

//         req.flash("info", "Booking rejected and guest notified");
//     }

//     res.redirect("/listing/pending");
// });
// 🔹 Middleware: auto-clean expired booking session
router.use((req, res, next) => {
    if (req.session.booking) {
        const EXPIRY_TIME = 30 * 60 * 1000;
        if (Date.now() - req.session.booking.createdAt > EXPIRY_TIME) {
            req.session.booking = null; // clear expired booking
        }
    }
    next();
});


module.exports = router;
