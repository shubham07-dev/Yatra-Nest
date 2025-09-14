const Joi = require('joi');  // joi apply validation on individual fields .
const review = require('./Models/review');

category: Joi.string().valid("Trending", "Rooms","Iconic Cities","Mountains","Castles","Pools","Camping","Farms","Arctic","Treehouse","Lakes").required(),



module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        image: Joi.string(), 
        category: Joi.string().required(),
        price: Joi.number().required().min(0),
        country: Joi.string().required(),
        location: Joi.string().required(),
        ownerUpiId: Joi.string().required()   // 👈 added here
    }).required()
});


module.exports.reviewSchema=Joi.object({
    review:Joi.object({
        rating:Joi.number().required().min(1).max(5),
        comment:Joi.string().required()
    }).required()
});