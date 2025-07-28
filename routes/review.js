const express=require("express");
const router=express.Router({mergeParams:true});
const wrapAsync=require("../util/wrapAsync.js")
const ExpressError=require("../util/ExpressError.js")
const {reviewSchema}=require("../Schema.js")
const Review=require("../Models/review.js");
const listing=require("../Models/listing.js");
const { isLoggedIn,isReviewAuthor } = require("../middleware.js");
const ReviewController=require("../controller/review.js")




// func for server side validation using joi for reviews
const validateReview=(req,res,next)=>{
    let {error}=reviewSchema.validate(req.body);
    if(error){
        let errmsg=error.details.map((el)=> el.message).join(",");
        throw new ExpressError(400,errmsg)
    }
    else{
        next();
    }
}



// review route

router.post("/", isLoggedIn,validateReview , wrapAsync(ReviewController.createReview));



//delete route for review
router.delete("/:reviewId", isReviewAuthor,isLoggedIn,wrapAsync(ReviewController.deleteReview));



module.exports=router;
