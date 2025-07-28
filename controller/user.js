const User = require("../Models/user")



module.exports.renderSignUpForm = (req, res) => {
    res.render("users/signup.ejs")
}



module.exports.signUp = async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Yatra-Nest")
            res.redirect("/listing")
        });

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup")
    }
}





module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs")
}





module.exports.login = async (req, res) => {
    req.flash("success", "Welcome to Yatra-Nest");
    let redirectUrl = res.locals.redirectUrl || "/listing";
    res.redirect(redirectUrl);
}





module.exports.logOut = (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "Logged Out Successfully !!")
        res.redirect("/listing");
    })
}