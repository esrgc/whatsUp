/*
Event map page
*/

var express = require('express');
var auth = require('authorized');
var router = express.Router();
var domain = require('../appDomain');
var User = domain.dataRepository.User;
var Event = domain.dataRepository.Event;
var geoCoder = require('mdimapgeocoder');


var isLoggedIn = domain.authentication.isLoggedIn;

//middleware makes sure user is logged in before proceeding.
router.use(isLoggedIn);

//set root path
router.use(function(req, res, next) {
  res.locals.rootPath = '../';
  next();
});


/* GET index page. */
router.get('/', function(req, res) {//Lookup users events and load them into panels with edit pencil?
  var done = function( err, user ){
    if( err ){
      return res.render('event/index', { title: "Express",
        message: req.flash('eventsMessage'),
        err: err
      });
    }
    res.render('event/index', { title: "Express", 
      message : req.flash('eventsMessage'),
      user: user
    });
  }
  User.findOne({ email: req.user.email }).populate('events').exec( function( err, user ){
    if( err){
      req.flash('eventsMesssage','Error retrieving events' );
      return done( err );
    }
    if( !user ){
      req.flash('eventsMesssage','Error retrieving events' );
      return done( true ); 
    }
    else
      return done( false, user );
  });

});

//Get add event page
router.get('/add', function( req, res ){
  res.render('event/add');
}); 

/* GET home page. */
router.get('/map', function(req, res) {
  res.render('event/map', { title: 'Express' });
});

router.get('/edit/:id', function( req, res ){
  var id = req.params.id;
  console.log("Got GET for event update", id);
  Event.findOne({ _id: id}, function( err, event ){
    res.render('event/edit',{ rootPath:"../../",event: event, detail: event.detail } );
  });

});
//
//POST routes.........................................................
//Delete event
router.post('/delete', 
  auth.can('manage event'), function( req, res ){//Authorize as user for event management
    console.log("User authorized, delete event");
    var id = req.body.id;
    var done = function( err, updatedUser ){
      if( err )
        res.render('event/index', { message: req.flash('eventsMessage'), err: err } );
      else
        res.redirect('/event');
      //res.render('event/index', { message: req.flash('eventsMessage'), user: updatedUser } );
    }
    Event.remove({ _id: id }, function( err, event ){
      if( err ){
        req.flash('eventsMessage', "Error looking up event" );
        return done( err );
      }
      if( !event ){
        req.flash('eventsMessage', "Could not find event");
        return done( );
      }
      User.findOne({ _id: req.user._id }, function( err, user ){//Find user and delete event id
        if( err ){
          req.flash("eventsMessage", "Error deleting event");
          return done( err );
        }
        if( ! user ){
          req.flash('eventsMessage', "Error deleting event");
          return done( true );
        }
        var index = user.events.indexOf( id );
        if( index > -1 ){
          user.events.splice( index, 1 );
          user.save( function( updatedUser ){
            req.flash('eventsMessage', 'Event deleted successfully');
            return done( false, updatedUser );
          });
        }
        else{
          req.flash('eventMessage', "Error deleting event");
          return done( true );
        }
      });
    });
  });
//
//
router.post('/edit', function( req, res ){
  console.log("Got post for edit");
});
//
//Get data from add event page, validate and save
router.post('/add', function( req, res ){
  console.log("Got post for add event");
  var done = function( err, event ){
    console.log("Done add");
    console.log(err);
    if( err )
      return res.render('event/add', { message: req.flash('eventsMessage'), err: err, event: event, detail: event.detail } );
    res.redirect('/event');

  }

  var data = req.body;
  var user = req.user;
  var newEvent = new Event({//Create new event model
    name: data.eventTitle,  
    _creator: user._id,
    date: new Date(),
    detail:{
      address: data.streetAddress,
      description: data.description,
      startDate: data.startDate + " " + data.startTime,
      endDate: data.endDate + " " + data.endTime,
      city: data.city,
      state: data.state,
      ZIP: data.zip
    }
  });

  User.findOne({ email: req.user.email }, function( err, user ){//Find user
    var location;
    if( err )
      return done( true );
    if( !user )
      return done( true );
    //Geocode
    geoCoder.search({//Use geocoder to lookup
      Street: data.street,
      City: data.city,
      State: data.state,
      ZIP: data.zip
    }, function( err, res ){
      if( err )
        return done( err, newEvent );
      if( res.candidates.length == 0 ){//If no candidates
        req.flash('eventsMessage', 'Could not find that address, please try agian.');
        return done( true, newEvent );
      }
      for( i in res.candidates  ){
        var place = res.candidates[i];
        if( res.score > 79 ) {
          location = res.candidates[i].location;//Else select first candidate
          break;
        }
      }
      //Add validation step
      newEvent.save(function( err ){//Save new event
        if( err){
          req.flash('eventsMessage','Error adding event');
          return done( err, newEvent );
        }
      user.pushEvent( newEvent._id );//push event to user
      user.save();//Save user
      done( false );
      });
    });     
  });
});


module.exports = router;
