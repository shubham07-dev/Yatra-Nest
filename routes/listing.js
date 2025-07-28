const express = require("express");
const router = express.Router();
const listing = require("../Models/listing.js")
const wrapAsync = require("../util/wrapAsync.js")
const ExpressError = require("../util/ExpressError.js")
const { listingSchema } = require("../Schema.js")
const { isLoggedIn, isOwner } = require("../middleware.js")
const listingController = require("../controller/listing.js")
const multer  = require('multer')
const {storage}=require("../cloudConfig.js")
const upload = multer({ storage })


// func for server side validation using joi
const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg)
    }
    else {
        next();
    }
}



// main route and  Create Route
router
.route("/")
.get( wrapAsync(listingController.index))
.post( isLoggedIn, 
    validateListing,
    upload.single("listing[image]"),
    wrapAsync(listingController.createLising));



// new route
router.get("/new", isLoggedIn, listingController.renderNewForm)



//show route  and //edit route[2] i.e Update Route and
//delete route

router
.route("/:id")
.get( wrapAsync(listingController.showListing))
.put( isLoggedIn, isOwner, validateListing, upload.single("listing[image]"), wrapAsync(listingController.updateListing))
.delete( isLoggedIn, isOwner, wrapAsync(listingController.deleteListing));







// edit route[1] 
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderCreateForm))

router.get("/:id/logged/reviews", isLoggedIn, listingController.showListingBeforeLogged);

module.exports = router;