const express = require("express");
const router = express.Router();
const User = require("../Models/user.js");
const wrapAsync = require("../util/wrapAsync");
const passport = require("passport");
const { saveredirectUrl } = require("../middleware.js");
const UserController=require("../controller/user.js")




// signup routes
router
.route("/signup")
.get( UserController.renderSignUpForm)
.post( wrapAsync(UserController.signUp))




// login routes
router
.route("/login")
.get( UserController.renderLoginForm)
.post( saveredirectUrl, passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
}),
    UserController.login
)




//loggout path

router.get("/logout",UserController.logOut)



module.exports = router;