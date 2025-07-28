if(process.env.NODE_ENV !="production"){
require('dotenv').config()
}


const express=require("express");
const app=express();
const mongoose =require("mongoose");
const path=require("path");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const ExpressError=require("./util/ExpressError.js");
const ListingRouter=require("./routes/listing.js");
const reviewsRouter=require("./routes/review.js");
const userRouter=require("./routes/user.js");
const session=require("express-session");
const MongoStore = require('connect-mongo');
const flash=require("connect-flash");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const User=require("./Models/user.js");



const DbUrl=process.env.AtLas_DB_URL;


main().then(()=>{
    console.log("connection Successful TO DB")
})
.catch(err => console.log(err));


async function main() {
  await mongoose.connect(DbUrl);  // atlas url 
}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,"/public")));


// mongo session store
const store= MongoStore.create({
    mongoUrl:DbUrl,
    crypto:{
        secret:"SSJV7865",
    },
    touchAfter:24*3600,

});

store.on("error",()=>{
    console.log("ERROR IN MONGO SESSION",err);
});

//Express Session
const sessionOption={
    store,
    secret:"SSJV7865",
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires:Date.now() + 7*24*60*60*1000,
        maxAge: 7*24*60*60*1000,
        httpOnly:true,
    },
};


// // home route
// app.get("/",(req,res)=>{
//     res.send("Hello welcome Sir !!")
// })




app.use(session(sessionOption));
app.use(flash());



//authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

//when user logged in
passport.serializeUser(User.serializeUser());
//when user logged out
passport.deserializeUser(User.deserializeUser());



app.use((req,res,next)=>{
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;
    next();
});




app.get("/demouser",async(req,res)=>{
    let newuser=new User({
        email:"abc@gmail.com",
        username:"shubham shukla"
    });
    let registeruser=await User.register(newuser,"abc");
    res.send(registeruser);
})





// using express routing for listing
app.use("/listing",ListingRouter);
// using express routing for reviews
app.use("/listing/:id/reviews",reviewsRouter);

// using express routing for user
app.use("/",userRouter);





// Redirect root to listing page
app.get("/", (req, res) => {
    res.redirect("/listing");
});








// //listing route
// app.get("/testlisting",async (req,res)=>{
//     let list1=new listing({
//         title:"my villa",
//         description:"best villa for tourists",
//         price:700,
//         location:"gomti nagar lucknow",
//         country:"India"
//     })

// // await list1.save();
// console.log("data saved")
// res.send("data saved successfully!!")

// })


app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found !!"));
});


app.use((err,req,res,next)=>{
    let {statusCode=500,message="Something Went Wrong !!"}=err;
    res.status(statusCode).render("Error.ejs",{message})
})


const PORT = process.env.PORT || 8080;

console.log("ENV PORT:", process.env.PORT); // for debugging

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
