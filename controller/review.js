const listing=require("../Models/listing")
const Review=require("../Models/review")


module.exports.createReview=async(req,res)=>{
   let Listing= await listing.findById(req.params.id);
    let newreview=new Review(req.body.review);
    newreview.author=req.user._id;
    
    Listing.reviews.push(newreview);

    await newreview.save();
  await newreview.populate("author");
    await Listing.save();
    console.log(newreview)
req.flash("success","New Review was Added")
    res.redirect(`/listing/${Listing._id}`);
}



module.exports.deleteReview=async(req,res)=>{
    let {id,reviewId}=req.params;
    await listing.findByIdAndUpdate(id, {$pull:{ reviews: reviewId }});
    await Review.findByIdAndDelete(reviewId);
req.flash("error","One Review is Deleted !!")
    res.redirect(`/listing/${id}`);

}