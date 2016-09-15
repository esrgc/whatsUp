var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', {
    title: "What's Up",
    req: req,
    message: req.flash('loginMessage')
  });
});

module.exports = router;
