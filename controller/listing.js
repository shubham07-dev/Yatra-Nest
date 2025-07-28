const listing=require("../Models/listing")
const fetch = require("node-fetch");

async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'YatraNest (shubham@yournest.com)' // Required by Nominatim
    }
  });
  const data = await response.json();

  if (data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    };
  } else {
    return null;
  }
}



// module.exports.index = async (req, res) => {
//   const { category, search } = req.query;
//   let query = {};
//   if (category) {
//     query.category = category;
//   }
//   let searchRegex;
//   if (search && search.trim() !== "") {
//     if(!isNaN(parseFloat(search))){
//       query.price={ $lte: parseFloat(search)};
//     }
//     else{
//       searchRegex = new RegExp(search, "i"); // case-insensitive
//       query.$or = [
//         { title: searchRegex },
//         { location: searchRegex },
//         { category: searchRegex },
//         { country: searchRegex },
//       ];

//     }
//   }
//   const allListings = await listing.find(query);
//   if(allListings.length===0){
//     req.flash("error", "No result found!!");
//     res.redirect("/listing");
//   }
//   else{
//     res.render("listing/index.ejs", {
//       allListings,
//       // currentCategory: category,
//       // searchQuery: search
//     });

//   }

// }

module.exports.index = async (req, res) => {
  let allListings;
  const { category, search } = req.query;
  let query = {};
  if (category) {
    query.category = category;
  }
  let searchRegex;
  if (search && search.trim() !== "") {
    if(!isNaN(parseFloat(search))){
      query.price={ $lte: parseFloat(search)};
    }
    else{
      searchRegex = new RegExp(search, "i"); // case-insensitive
      query.$or = [
        { title: searchRegex },
        { location: searchRegex },
        { category: searchRegex },
        { country: searchRegex },
      ];

    }
  }
  const categoryListings = await listing.find(query);
  const normalListings = await listing.find({});
  // console.log(query, categoryListings, normalListings);
  if(categoryListings.length===0 && Object.keys(query).length !== 0){
    req.flash("error", "No result found!!");
    res.redirect("/listings");
  }
  else{
    if(categoryListings.length!=0){
      allListings=categoryListings;
    }
    else{
      allListings=normalListings;
    }
    res.render("listing/index.ejs", {
      allListings,
      // currentCategory: category,
      // searchQuery: search
    });

  }

}


module.exports.renderNewForm=(req, res) => {
    res.render("listing/new.ejs")
}



module.exports.showListing=async (req, res) => {
    let { id } = req.params;
    const listingData = await listing.findById(id).populate({path:"reviews",populate:{path:"author"}}).populate("owner");
    if (!listingData) {
        req.flash("error", "Listing You are Requested For does not exist !!");
        return res.redirect("/listing");
    }


    res.render("listing/show.ejs", { listingData });
}

module.exports.showListingBeforeLogged = async (req, res) => {
    let { id } = req.params;
    let listingData = await listing.findById(id).populate({ path: "reviews", populate: { path: "author" } }).populate("owner");
    res.render("listings/show.ejs", { listingData });
}



module.exports.createLising=async (req, res) => {
    let url=req.file.path;
    let  filename=req.file.filename;

    // hum yha distructured use nhi kar rahe hai
    const newlisting = new listing(req.body.listing);   //we use this method 
   newlisting.owner=req.user._id;
   newlisting.image={url,filename};
     // 🧭 Geocode location
    const location = req.body.listing.location;
    const coordinates = await geocodeLocation(location);

    newlisting.coordinates = coordinates || { lat: 0, lng: 0 }; // default fallback

    await newlisting.save();
    req.flash("success", "New List is Created")
    res.redirect("/listing")
}



module.exports.renderCreateForm=async (req, res) => {
    let { id } = req.params;
    const listingData = await listing.findById(id);
    if (!listingData) {
        req.flash("error", "Listing You are Requested For does not exist !!");
        return res.redirect("/listing");
    }
let originalImage=listingData.image.url;
originalImage=originalImage.replace("/upload","/upload/w_250")
    res.render("listing/edit.ejs", { listingData,originalImage });

}



module.exports.updateListing=async (req, res) => {
    let { id } = req.params;
   let Listing= await listing.findByIdAndUpdate(id, { ...req.body.listing })

if(typeof req.file!=="undefined"){
      let url=req.file.path;
    let  filename=req.file.filename;
    Listing.image={url,filename};
    await Listing.save();

}

    req.flash("success", " Listing was Updated !!")
    res.redirect(`/listing/${id}`)
}




module.exports.deleteListing=async (req, res) => {
    let { id } = req.params;
    let deletedList = await listing.findByIdAndDelete(id)
    req.flash("error", "Listing is Deleted")
    console.log(deletedList);
    res.redirect("/listing")
}