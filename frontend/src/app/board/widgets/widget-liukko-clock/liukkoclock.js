// jshint ignore: start

/**
 * CoolClock 2.1.4
 * Copyright 2010, Simon Baird
 * Released under the BSD License.
 *
 * Display an analog clock using canvas.
 * http://randomibis.com/coolclock/
 *
 */

// Constructor for CoolClock objects
window.CoolClock = function(options) {
  return this.init(options);
};

// Config contains some defaults, and clock skins
CoolClock.config = {
  tickDelay: 100,
  longTickDelay: 15000,
  defaultRadius: 150,
  renderRadius: 100,
  defaultSkin: "swissRail",
  // Should be in skin probably...
  // (TODO: allow skinning of digital display)
  showSecs: true,
  showAmPm: false,

  skins:	{
    // There are more skins in moreskins.js
    // Try making your own skin by copy/pasting one of these and tweaking it
    swissRail: {
      outerBorder: { lineWidth: 2, radius:150, color: "black", alpha: 1, fillColor: "rgba(255, 255, 255, .7)" },
      smallIndicator: { lineWidth: 2, startAt: 88, endAt: 92, color: "black", alpha: 1 },
      largeIndicator: { lineWidth: 4, startAt: 79, endAt: 92, color: "black", alpha: 1 },
      hourHand: { lineWidth: 8, startAt: -15, endAt: 50, color: "black", alpha: 1 },
      minuteHand: { lineWidth: 7, startAt: -15, endAt: 75, color: "black", alpha: 1 },
      secondHand: { lineWidth: 1, startAt: -20, endAt: 85, color: "red", alpha: 1 },
            secondHand1: { lineWidth: 1, startAt: -20, endAt: 85, color: "red", alpha: 0.5 },
            secondHand2: { lineWidth: 1, startAt: -20, endAt: 85, color: "red", alpha: 0.2 },
      secondDecoration: { lineWidth: 1, startAt: 70, radius: 4, fillColor: "red", color: "red", alpha: 1 }
    }
  },

  // Test for IE so we can nurse excanvas in a couple of places
  isIE: !!document.all,

  // Will store (a reference to) each clock here, indexed by the id of the canvas element
  clockTracker: {},

  // For giving a unique id to coolclock canvases with no id
  noIdCount: 0
};

// Define the CoolClock object's methods
CoolClock.prototype = {
  // Initialise using the parameters parsed from the colon delimited class
  init: function(options) {
    // Parse and store the options
    this.canvasId       = options.canvasId;
    this.skinId         = options.skinId || CoolClock.config.defaultSkin;
    this.displayRadius  = options.displayRadius || CoolClock.config.defaultRadius;
    this.showSecondHand = typeof options.showSecondHand == "boolean" ? options.showSecondHand : true;
    this.gmtOffset      = (options.gmtOffset != null && options.gmtOffset != '') ? parseFloat(options.gmtOffset) : null;
    this.showDigital    = typeof options.showDigital == "boolean" ? options.showDigital : false;
    this.logClock       = typeof options.logClock == "boolean" ? options.logClock : false;
    this.logClockRev    = typeof options.logClock == "boolean" ? options.logClockRev : false;

    this.tickDelay      = CoolClock.config[ this.showSecondHand ? "tickDelay" : "longTickDelay" ];

    // Get the canvas element
    this.canvas = document.getElementById(this.canvasId);

    // Make the canvas the requested size. It's always square.
    this.canvas.setAttribute("width", (this.displayRadius * 2).toString());
    this.canvas.setAttribute("height", (this.displayRadius * 2).toString());
    this.canvas.style.width = this.displayRadius*2 + "px";
    this.canvas.style.height = this.displayRadius*2 + "px";

    // Explain me please...?
    this.renderRadius = CoolClock.config.renderRadius;
    this.scale = this.displayRadius / this.renderRadius;

    // Initialise canvas context
    this.ctx = this.canvas.getContext("2d");
    this.ctx.scale(this.scale,this.scale);



    // Keep track of this object
    CoolClock.config.clockTracker[this.canvasId] = this;

    // Define coffeebreak
    this.coffeeBreak = {
      // Start and end times of coffeebreaks
      times:  [],
      motion: "none",
      // How much time we want more
      timeBonus: 0,

      dayStartMs: function(time)
      {
        var dayStart = new Date();

        dayStart.setHours(0, 0, 0, 0);
        return time.getTime() - dayStart.getTime();
      },

      setCoffeeBreakTimes: function(times)
      {
        var timeFields = times.split('/'), i= 1, ts = new Date(), te = new Date();

        if(timeFields.length<3)
          return;

        this.timeBonus = timeFields[0]*60*1000;
        while(i+4 <= timeFields.length)
        {
          ts.setHours(timeFields[i], timeFields[i+1], 0, 0);
          te.setHours(timeFields[i+2], timeFields[i+3], 0, 0);
          this.times.push({start: this.dayStartMs(ts),
            end: this.dayStartMs(te)});
          i += 4;
        }
      },

      timeSpanType: function(time) {
        var dayStartMs = this.dayStartMs(time);

        for(var i=0; i<this.times.length; i++)
        {
          if(     dayStartMs >= this.times[i].start-this.timeBonus &&
            dayStartMs <= this.times[i].start-this.timeBonus/2)
          {   // Speeup the time. hurry for coffee break
            this.motion = "hurry";
            return {timeSpantype: 1, timeDiff: dayStartMs - (this.times[i].start-this.timeBonus) };
          }
          else if(dayStartMs >= this.times[i].start - this.timeBonus/2 &&
            dayStartMs <= this.times[i].start + this.timeBonus/2)
          {
            this.motion = "slow";
            return {timeSpanType: 2, timeDiff: this.timeBonus/2 - (dayStartMs - (this.times[i].start - this.timeBonus/2))/2};
          }
          else if(dayStartMs >= this.times[i].end - this.timeBonus/2 &&
            dayStartMs < this.times[i].end + this.timeBonus/2)
          {
            this.motion = "slow";
            return {timeSpantype: 3, timeDiff: (dayStartMs - (this.times[i].end - this.timeBonus/2))/-2};
          }
          else if(dayStartMs >= this.times[i].end + this.timeBonus/2 &&
            dayStartMs <= this.times[i].end + this.timeBonus)
          {
            this.motion = "hurry";
            return {timeSpanType: 4, timeDiff: -1*(this.timeBonus/2 - (dayStartMs - (this.times[i].end + this.timeBonus/2)))};
          }
        }
        this.motion = "none";
        return {timeSpanType: 0, timeDiff: 0};
      }
    };

      this.coffeeBreak.setCoffeeBreakTimes(options.coffeeBreak || '');

    // Start the clock going
    this.tick();

    return this;
  },

  // Draw a circle at point x,y with params as defined in skin
  fullCircleAt: function(x,y,skin) {
    this.ctx.save();
    this.ctx.globalAlpha = skin.alpha;
    this.ctx.lineWidth = skin.lineWidth;

    if (!CoolClock.config.isIE) {
      this.ctx.beginPath();
    }

    if (CoolClock.config.isIE) {
      // excanvas doesn't scale line width so we will do it here
      this.ctx.lineWidth = this.ctx.lineWidth * this.scale;
    }

    this.ctx.arc(x, y, skin.radius, 0, 2*Math.PI, false);

    if (CoolClock.config.isIE) {
      // excanvas doesn't close the circle so let's fill in the tiny gap
      this.ctx.arc(x, y, skin.radius, -0.1, 0.1, false);
    }

    if (skin.fillColor) {
      this.ctx.fillStyle = skin.fillColor;
      this.ctx.fill();
    }
    else {
      // XXX why not stroke and fill
      this.ctx.strokeStyle = skin.color;
      this.ctx.stroke();
    }
    this.ctx.restore();
  },

  // Draw some text centered vertically and horizontally
  drawTextAt: function(theText,x,y) {
    this.ctx.save();
    this.ctx.font = '15px sans-serif';
    var tSize = this.ctx.measureText(theText);
    if (!tSize.height) tSize.height = 15; // no height in firefox.. :(
    this.ctx.fillText(theText,x - tSize.width/2,y - tSize.height/2);
    this.ctx.restore();
  },

  lpad2: function(num) {
    return (num < 10 ? '0' : '') + num;
  },

  tickAngle: function(ms) {
      return ms/60000.0;
  },

  timeText: function(hour,min,sec) {
    var c = CoolClock.config;
    return '' +
      (c.showAmPm ? ((hour%12)==0 ? 12 : (hour%12)) : hour) + ':' +
      this.lpad2(min) +
      (this.showSecondHand ? ':' + this.lpad2(sec) : '') +
      (c.showAmPm ? (hour < 12 ? ' am' : ' pm') : '')
      ;
  },

  // Draw a radial line by rotating then drawing a straight line
  // Ha ha, I think I've accidentally used Taus, (see http://tauday.com/)
  radialLineAtAngle: function(angleFraction,skin) {
    this.ctx.save();
    this.ctx.translate(this.renderRadius,this.renderRadius);
    this.ctx.rotate(Math.PI * (2.0 * angleFraction - 0.5));
    this.ctx.globalAlpha = skin.alpha;
    this.ctx.strokeStyle = skin.color;
    this.ctx.lineWidth = skin.lineWidth;

    if (CoolClock.config.isIE)
    // excanvas doesn't scale line width so we will do it here
      this.ctx.lineWidth = this.ctx.lineWidth * this.scale;

    if (skin.radius) {
      this.fullCircleAt(skin.startAt,0,skin)
    }
    else {
      this.ctx.beginPath();
      this.ctx.moveTo(skin.startAt,0);
      this.ctx.lineTo(skin.endAt,0);
      this.ctx.stroke();
    }
    this.ctx.restore();
  },

  render: function(hour,min,ms) {
    // Get the skin
    var skin = CoolClock.config.skins[this.skinId];
    if (!skin) skin = CoolClock.config.skins[CoolClock.config.defaultSkin];

    // Clear
    this.ctx.clearRect(0,0,this.renderRadius*2,this.renderRadius*2);

    // Draw the outer edge of the clock
    if (skin.outerBorder)
      this.fullCircleAt(this.renderRadius,this.renderRadius,skin.outerBorder);

    // Draw the tick marks. Every 5th one is a big one
    for (var i=0;i<60;i++) {
      (i%5)  && skin.smallIndicator && this.radialLineAtAngle(this.tickAngle(i*1000),skin.smallIndicator);
      !(i%5) && skin.largeIndicator && this.radialLineAtAngle(this.tickAngle(i*1000),skin.largeIndicator);
    }

    // Draw the hands
    if (skin.hourHand)
      this.radialLineAtAngle(this.tickAngle(((hour%12)*5 + min/12.0)*1000),skin.hourHand);

    if (skin.minuteHand)
      this.radialLineAtAngle(this.tickAngle(1000*min),skin.minuteHand);

    if (this.showSecondHand && skin.secondHand) {
      this.radialLineAtAngle(this.tickAngle(ms), skin.secondHand);

      if(this.coffeeBreak.motion === "hurry") {
        this.radialLineAtAngle(this.tickAngle(ms - 400), skin.secondHand1);
        this.radialLineAtAngle(this.tickAngle(ms - 800), skin.secondHand2);
        console.log("hurry")
      }
      else if(this.coffeeBreak.motion === "slow") {
        this.radialLineAtAngle(this.tickAngle(ms + 400), skin.secondHand1);
        this.radialLineAtAngle(this.tickAngle(ms + 800), skin.secondHand2);
        console.log("slow")
     }
    }
  },

  // Check the time and display the clock
  refreshDisplay: function() {
    var now = new Date(), tst;

    tst = this.coffeeBreak.timeSpanType(now);

    if(Math.abs(tst.timeDiff) > 0.1)
    {
      now.setTime(now.getTime() + tst.timeDiff);
    }

    if (this.gmtOffset != null) {
      // Use GMT + gmtOffset
      var offsetNow = new Date(now.valueOf() + (this.gmtOffset * 1000 * 60 * 60));
      this.render(offsetNow.getUTCHours(),offsetNow.getUTCMinutes(),offsetNow.getUTCSeconds());
    }
    else {
      // Use local time
      this.render(now.getHours(),now.getMinutes(),now.getSeconds()*1000 + now.getMilliseconds());
    }
  },

  // Set timeout to trigger a tick in the future
  nextTick: function() {
    setTimeout("CoolClock.config.clockTracker['"+this.canvasId+"'].tick()",this.tickDelay);
  },

  // Check the canvas element hasn't been removed
  stillHere: function() {
    return document.getElementById(this.canvasId) != null;
  },

  // Main tick handler. Refresh the clock then setup the next tick
  tick: function() {
    if (this.stillHere()) {
      this.refreshDisplay();
      this.nextTick();
    }
  }
};

// Find all canvas elements that have the CoolClock class and turns them into clocks
CoolClock.findAndCreateClocks = function() {
  // (Let's not use a jQuery selector here so it's easier to use frameworks other than jQuery)
  var canvases = document.getElementsByTagName("canvas");
  for (var i=0;i<canvases.length;i++) {
    // Pull out the fields from the class. Example "CoolClock:chunkySwissOnBlack:1000"
    var fields = canvases[i].className.split(" ")[0].split(":");
    if (fields[0] == "CoolClock") {
      if (!canvases[i].id) {
        // If there's no id on this canvas element then give it one
        canvases[i].id = '_coolclock_auto_id_' + CoolClock.config.noIdCount++;
      }
      // Create a clock object for this element
      new CoolClock({
        canvasId:       canvases[i].id,
        skinId:         fields[1],
        displayRadius:  fields[2],
        showSecondHand: fields[3]!='noSeconds',
        gmtOffset:      fields[4],
        showDigital:    fields[5]=='showDigital',
        logClock:       fields[6]=='logClock',
        logClockRev:    fields[6]=='logClockRev',
        coffeeBreak:    fields[7]
      });
    }
  }
};

// If you don't have jQuery then you need a body onload like this: <body onload="CoolClock.findAndCreateClocks()">
// If you do have jQuery and it's loaded already then we can do it right now
if (window.jQuery) jQuery(document).ready(CoolClock.findAndCreateClocks);
