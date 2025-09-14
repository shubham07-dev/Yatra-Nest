// utils/bookingUtils.js

/**
 * Normalize date (remove time part, keep only YYYY-MM-DD).
 */
function normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get all dates in a range [start, end] as YYYY-MM-DD strings.
 */
function getDateRange(startDate, endDate) {
    let dates = [];
    let start = normalizeDate(startDate);
    let end = normalizeDate(endDate);

    while (start <= end) {
        dates.push(start.toISOString().split("T")[0]);
        start.setDate(start.getDate() + 1);
    }

    return dates;
}

/**
 * Check if requested dates overlap with already booked dates.
 */
function hasOverlap(newDates, bookedDates) {
    return newDates.some(d => bookedDates.includes(d));
}

/**
 * Calculate cost with multipliers + GST.
 * 
 * - Base price per day = listing.price
 * - 4–6 days → 10% extra
 * - 7+ days → 20% extra
 * - GST = 18%
 */
function calculatePrice(basePrice, startDate, endDate) {
    const newDates = getDateRange(startDate, endDate);
    const days = newDates.length;

    let multiplier = 1;
    if (days >= 4 && days <= 6) multiplier = 1.1;
    else if (days >= 7) multiplier = 1.2;

    const baseCost = basePrice * days * multiplier;
    const gst = baseCost * 0.18;
    const totalCost = Math.round(baseCost + gst);

    return { days, baseCost, gst, totalCost, newDates };
}

module.exports = { normalizeDate, getDateRange, hasOverlap, calculatePrice };