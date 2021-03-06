/*
This defines schema for model Event
*/
// var connectionStr = require('../../config').database.mongodb;
'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var moment = require('moment'); //for datetime math
require('moment-recur'); //recurring calculation
var later = require('later'); //for recurring event
var _ = require('lodash');
var config = require('../../config');

mongoose.Promise = require('bluebird');
// mongoose.connect(connectionStr);
// Validators ============================================

//Event schema
var EventSchema = new Schema({

  // id: String,
  _creator: { type: Schema.Types.ObjectId, ref: 'User' }, //populated field
  name: {
    type: String,
    required: [true, "Event name is required"]
    // validate: {
    //   validator: nameValidator,
    //   message: "Name entered is invalid"
    // }
  },
  date: Date,
  location: Object,
  description: {
    type: String,
    required: [true, 'Description required']
  },
  start: {
    type: Date,
    required: [true, 'Start Date is required']
  },
  end: {
    type: Date,
    required: [true, 'End Date required']
  },
  address: {
    type: String,
    required: [true, 'Street Address required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  zip: {
    type: Number,
    required: [true, 'ZIP is required']
  },
  repeat: {
    type: Boolean,
    default: false,
    required: [true, 'Please specify if this event repeats.']
  },
  repeatEnd: { type: Date, default: null },
  frequency: { type: String, default: 'daily' }, //daily, weekly, monthly, and yearly
  every: { type: Number, default: 1 }, //recurring frequency
  dayOfMonth: [{
    type: Number,
    min: [1, 'Please enter date between (1-31)'],
    max: [31, 'Please enter date between (1-31)']
  }], //1,2,3...31 
  dayOfWeek: [{
    type: Number,
    default: [],
    min: [1, 'Please enter date between (1-7)'],
    max: [7, 'Please enter date between (1-7)']
  }], //Monday, Tuesday,...Sunday (1-7)
  dayOfWeekCount: {
    type: Number,
    default: null,
    min: [1, 'Invalid value. Please enter value from 1-5'],
    max: [5, 'Invalid value. Please enter value from 1-5']
  }, //first, second,...fifth (1-5)
  monthOfYear: [{
    type: Number,
    default: null,
    min: [1, 'Invalid value. Please enter value from 1-12'],
    max: [12, 'Invalid value. Please enter value from 1-12']
  }], //jan, feb, mar,...dec (1-12)
  schedule: Schema.Types.Mixed, //later.js calculated schedule
  occurences: [Date], //proccessed occurences
  url: { type: String, default: null }

}, {
  validateBeforeSave: false //prevent pre-save validation
});
//calculate how event will occur
EventSchema.methods.calculateSchedule = function() {
  var scope = this;

  // set later to use local time
  later.date.localTime();

  //not repeated
  if (typeof scope.repeat == 'undefined' || !scope.repeat)
    return;

  var schedule = null,
    occurences = [];

  try {
    switch (scope.frequency) {
      case 'daily':
        schedule = later.parse.recur()
          .every(scope.every).dayOfYear()
          .startingOn(later.dayOfYear.val(scope.start));
        // let {dy} = schedule.schedules[0];
        // let startDay = dy[0] - scope.every;
        // let retro = [];

        // while(startDay > 0) {
        //   retro.push(startDay);
        //   startDay -= scope.every;
        // } 

        // retro = retro.reverse();
        // //merge schedule
        // schedule.schedules[0].dy = retro.concat(dy);

        break;
      case 'weekly':
        console.log('Calculating weekly schedule...');
        console.log(scope);
        //recurs every # of week
        // schedule = later.parse.recur()
        //   .every(scope.every * 7).dayOfYear()
        //   .startingOn(later.dayOfYear.val(scope.start));
        schedule = later.parse.recur()
          .every(scope.every).weekOfYear()
          .startingOn(later.weekOfYear.val(scope.start))
        // .every(scope.every).weekOfYear();
        //on specific days of week
        scope.dayOfWeek.forEach(function(d) {
          schedule.on(d).dayOfWeek();
        });
        break;
      case 'monthly':
        //occur every # of month
        schedule = later.parse.recur()
          .every(scope.every).month()
          .startingOn(later.month.val(scope.start));
        //on days of month
        if (scope.dayOfMonth.length > 0)
          scope.dayOfMonth.forEach(function(d) {
            schedule.on(d).dayOfMonth();
          });
        //or on day of week count
        else if (scope.dayOfWeek.length > 0 && scope.dayOfWeekCount != null) {
          //day of week count
          schedule.on(scope.dayOfWeekCount).dayOfWeekCount();
          //day of week
          scope.dayOfWeek.forEach(function(d) {
            schedule.on(d).dayOfWeek();
          });
        }
        break;
      case 'yearly':
        //occurs every # year
        schedule = later.parse.recur()
          .every(scope.every).year()
          .startingOn(later.year.val(scope.start));
        //in months
        if (scope.monthOfYear.length > 0)
          scope.monthOfYear.forEach(function(d) {
            schedule.on(d).month();
          });
        //day of week or on starting day
        if (scope.dayOfWeek.length > 0 && scope.dayOfWeekCount != null) {
          //day of week count
          schedule.on(scope.dayOfWeekCount).dayOfWeekCount();
          //day of week
          scope.dayOfWeek.forEach(function(d) {
            schedule.on(d).dayOfWeek();
          });
        } else { //on starting day
          let date = scope.start.getDate();
          schedule.on(date).dayOfMonth();
        }
        break;
    }
  } catch (e) {
    //error has occur
    console.log(e);
    return null;
  }

  //if schedule was failed to define
  if (schedule == null)
    return null;
  else {
    //add start time
    // let startTime = later.time.val(scope.start).toString();
    // schedule.on(startTime).time();
  }

  // //calculate occurences
  // if (scope.repeatEnd != null)
  //   occurences =
  //   later.schedule(schedule)
  //   .next(futureOccurencesCount, scope.start, scope.repeatEnd);
  // else
  //   occurences =
  //   later.schedule(schedule)
  //   .next(futureOccurencesCount, scope.start);

  //store results to model
  scope.schedule = { schedules: schedule.schedules, exceptions: schedule.exceptions };
  // scope.occurences = occurences;
  //return occurences;
};

EventSchema.statics.calculateLaterOccurrences = function(event, futureRecurring) {
  // set later to use local time
  //later.date.localTime();
  // console.log(event);
  let scope = event,
    occurences = [],
    futureOccurencesCount,
    schedule = event.schedule;
  console.log(scope.start);

  if (typeof schedule == 'undefined')
    return null;

  //1000 occurences will be calculated -- 
  //well i think 1000 is a default value
  //anyway  
  futureOccurencesCount = futureRecurring || 1000;
  console.log('calculating occurences...');
  // console.log(futureOccurencesCount);
  //calculate occurences
  if (scope.repeatEnd != null)
    occurences =
    later.schedule(schedule)
    .next(futureOccurencesCount, scope.start, scope.repeatEnd);
  else
    occurences =
    later.schedule(schedule)
    .next(futureOccurencesCount, scope.start);

  //scope.occurences = occurences;
  return occurences;
}

EventSchema.set('toObject', { getters: true });

EventSchema.statics.calculateOccurrences = (event, start, end) => {
  // set later to use local time
  later.date.localTime();

  var scope = event;
  //not repeated
  if (typeof scope.repeat == 'undefined' || !scope.repeat)
    return null;

  var schedule = null,
    occurences = [],
    repeatEndDate;
  console.log('repeat ends on: %s', scope.repeatEnd);

  //end date
  if (scope.repeatEnd != null) {
    repeatEndDate = moment(scope.repeatEnd);
  } else {
    repeatEndDate = moment(end);
  }

  //start date
  let startDate = moment(scope.start);
  // let calendarStart = moment(start);
  // //select later start date
  // if(startDate.isBefore(calendarStart))
  //   startDate = calendarStart;

  console.log('repeatEndDate %s', repeatEndDate);
  //create schedule
  schedule = moment(startDate).recur(repeatEndDate);


  let next = [];

  try {
    switch (scope.frequency) {
      case 'daily':
        //set up schedule
        schedule.every(scope.every).day();
        break;
      case 'weekly':
        console.log('Calculating weekly schedule...');
        schedule.every(scope.every).week();
        break;
      case 'monthly':
        console.log('Calculating monthly schedule...');
        //occur every # of month
        if(scope.dayOfWeek.length == 0)
          schedule.every(scope.every).month();
        else{
          //create a new schedule to set recurrences for every > 2 months
          let monthlySchedule = moment(startDate).recur(repeatEndDate);
          //figure out month of year using the new schedule
          let monthsToRecur = monthlySchedule.every(scope.every).month()
            .all('L');
          
          monthsToRecur = _.map(monthsToRecur, 
            (d) => parseInt(moment(d).format('M')) -1);  
          console.log(monthsToRecur);  

          schedule
            .every(scope.dayOfWeek).daysOfWeek()
            .every(scope.dayOfWeekCount).weeksOfMonthByDay()
            .every(monthsToRecur).monthsOfYear();
        }
        break;
      case 'yearly':


        break;
    }
  } catch (e) {
    //error has occur
    console.log(e);
    return null;
  }
  
  console.log(schedule);
  
  //generate occurrences
  if(scope.frequency == 'yearly') {
    // console.log(EventSchema.statics);
    occurences = EventSchema.statics.calculateLaterOccurrences(scope);
  }
  else
    occurences = schedule.all('L');

 
  return occurences;
}

module.exports = mongoose.model('Event', EventSchema);