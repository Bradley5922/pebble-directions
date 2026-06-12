/**
* SETUP OVERVIEW
*
* About the send messages
* –––
* (1) Overview data is send (distance, time needed)
* (2) Step icon data is send as a 20 char string (each char encodes one icon!)
* (3) Step data array is send (each step string, max 100 entrys) -> THE LAST SEND INDEX + 1 IS THE LENGTH!
* (4) Success value is send (terminates the transmittion; it's true/false
*   value determines whether the transmition was successfull or not (E.g.
*   if false is send as the success first, no route was found)
*
* About the success codes:
* –––
* 0 = Success; 1 = Route not found; 2 = Too many steps; 3 = No current position found;
* 4 = Address not found; 5 = No api key set; 6 = Api key rejected; 7 = Phone has no internet
* The code is send in the way of: code + messageNumber * messagePadding
* (the codes must stay in the range 0-9, since messagePadding is 10!)
*
* About the recived message:
* –––
* Field: SEARCH
* Contents: {selected_type}{address} (e.g. 0Brockhofweg 9)
*   The first character is always the type selected, the rest
*   is the written address.
* {selected_type} vals: 0 = Car; 1 = Bike; 2 = Train; 3 = Walk;
*
* About the step icon data string
* –––
* Chars map to the following icons:
* type: 'a', forward: 'b', right: 'c', left: 'd', uRight: 'e', uLeft: 'f', attr: 'g', final: 'h'
*
* About the automatic navigation
* –––
* The automatic navigation is only avilable to certain route types. If enabled, the JS part will
* listen to location updates and send the current step-index to the watch whenever it changes.
*
* About the config of 'named addresses'
* –––
* The config stores an array of these name / address pairs, every time a search request hits the
* phone the recived search string is matched against the names of all entrys and replaced with the
* addess if a match is found.
*/


// Data keys
var keys = require('message_keys');
var maxStepCount = 100;
var maxStepStringLength = 128;
var currentMessageNumber = 0;
var messagePadding = 10;

// Location services
var locationService = require('./location.js');
// Configuration
var config = require('./config.js');
// Route data
var routeData = {
  stepPositionList: [],
  currentStep: 0,
  watchId: null,
};


// App Message functions
function sendSuccess(code, messageNumber) {
  // Build message
  var key = keys.SUCCESS;
  var dict = {};
  dict[key] = code + (messageNumber * messagePadding);

  // Send message to pebble
  Pebble.sendAppMessage(dict, function() {
    // Success!
    console.log('Transmission completed:', code, messageNumber);
  }, function() {
    // Error
    console.log('Transmission failed at [SUCCESS MESSAGE]');
  });
}

// Truncate a string so its utf-8 representation fits the step buffer on the watch.
// The watch buffer is maxStepStringLength BYTES including the null terminator, while
// substr counts characters - non-ascii characters take several bytes each!
function truncateForWatch(text) {
  var maxBytes = maxStepStringLength - 1; /* leave room for the null terminator */
  // Drop lone surrogates, they can not be utf-8 encoded
  text = text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
  // Remove characters from the end until the byte length fits (encodeURIComponent escapes
  // each non-ascii byte as '%XX', so replacing those with one char counts the bytes)
  while (encodeURIComponent(text).replace(/%[0-9A-Fa-f]{2}/g, '.').length > maxBytes) {
    text = text.substr(0, text.length - 1);
  }
  return text;
}

function sendStepItem(stepList, index, messageNumber) {
  // Build message
  var key = keys.INSTRUCTION_LIST;
  var dict = {};
  dict[key] = truncateForWatch(stepList[index]);

  // Send message to pebble
  Pebble.sendAppMessage(dict, function() {
    // Success, send next item
    index ++;
    if (index < stepList.length && index < maxStepCount) {
      // Recursive callbacks, hell yeah!
      sendStepItem(stepList, index, messageNumber);
    } else {
      // We are finished
      sendSuccess(0, messageNumber);
    }
  }, function() {
    // Error
    console.log('Transmission failed at index '.concat(index));
  });
}

function sendRoute(success, distance, time, stepList, stepIconsString, messageNumber, errorCode) {
  // Send message to pebble if a route was found
  if (success && maxStepCount >= stepList.length) {
    // Build message
    var keyDistance = keys.DISTANCE;
    var keyTime = keys.TIME;
    var keyIcons = keys.INSTRUCTION_ICONS;
    var dict = {};
    dict[keyDistance] = +distance;
    dict[keyTime] = +time;
    dict[keyIcons] = ''.concat(stepIconsString);

    // Transmit
    Pebble.sendAppMessage(dict, function() {
      // Success!
      sendStepItem(stepList, 0, messageNumber);
    }, function() {
      // Error
      console.log('Transmission failed at [OVERVIEW]');
    });
  } else if (success && maxStepCount < stepList.length) {
    // Too many steps error
    sendSuccess(2, messageNumber);
  } else {
    // Send the specific error code reported by the location service (fallback: route not found)
    sendSuccess(errorCode || 1, messageNumber);
  }
}

// Send the new current index
function sendCurrentStep(index, shouldRetry) {
  // Build the message
  var keyCurrent = keys.CURRENT;
  var dict = {};
  dict[keyCurrent] = +index;

  // Transmit
  Pebble.sendAppMessage(dict, function() {
    // Success!
    console.log('Current step send:', index);
  }, function() {
    // Error, retry if allowed
    if (shouldRetry === true) {
      sendCurrentStep(index, false);
    } else {
      console.log('Transmission of current step failed');
    }
  });
}

// Start sending current step information
function startCurrentStepUpdates(stepPositionList) {
  // Log the start of step updates
  console.log('Current step updates started');
  // Store the current route data
  routeData.stepPositionList = stepPositionList;
  routeData.currentStep = 0;
  // Register the location updates
  routeData.watchId = navigator.geolocation.watchPosition(function(pos) {
    try {
      // New position was recived
      var lat = pos.coords.latitude;
      var lon = pos.coords.longitude;
      var accuracy = pos.coords.accuracy;
      var newStep = locationService.getCurrentStepIndex(routeData.stepPositionList, lat, lon, accuracy, routeData.currentStep);
      if (newStep > routeData.currentStep) {
        sendCurrentStep(newStep, true);
        routeData.currentStep = newStep;
      }
    } catch (e) {}
  },
  function() {
    // Error while reciving location update
  }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
}

// Stop sending current step information
function stopCurrentStepUpdates() {
  // Log the stop of step updates
  console.log('Current step updates stopped');
  // Clear the watch and stop receiving updates
  navigator.geolocation.clearWatch(routeData.watchId);
}

// Fetch a route from the google api and send it to the pebble
function fetchAndSendRoute(routeType, searchText, messageNumber) {
  // Log the recived data
  console.log('Route type:', routeType);
  console.log('Search text:', searchText);
  // Voice dictation tends to append punctuation (e.g. "Work.") and may add
  // surrounding whitespace - strip it so the text matches named addresses and
  // geocodes cleanly.
  searchText = searchText.replace(/^[\s.,!?;:'"-]+/, '').replace(/[\s.,!?;:'"-]+$/, '');
  // Convert the search text using the named addresses (case-insensitive)
  config.getNamedAddresses().forEach(function(namedAddress) {
    if (namedAddress.name.toLowerCase() == searchText.toLowerCase()) {
      searchText = namedAddress.address;
      console.log('Search text was named address:', searchText);
    }
  });
  // Load a route from the google api. Data format: { distance, time, stepList[string], stepIconsString }
  locationService.createRoute(routeType, searchText, function(success, data, errorCode) {
    // Log the route data
    console.log('Will send:', success, data.distance, data.time, data.stepList.length, data.stepIconsString, messageNumber, 'error code:', errorCode);
    // Send the route data to the watch
    sendRoute(success, data.distance, data.time, data.stepList, data.stepIconsString, messageNumber, errorCode);
    // If the loading was successfull, start watching the position if the route type is bike or walk
    if (success && (routeType == 1 || routeType == 3)) {
      startCurrentStepUpdates(data.stepPositionList);
    }
  });
}

// Accept data from the pebble watch
Pebble.addEventListener('appmessage', function(e) {
  // Get the dictionary from the message
  var dict = e.payload;

  // Does the SEARCH field exist?
  if (dict['SEARCH']) {
    // Get the current message number and increment the message number
    var messageNumber = currentMessageNumber;
    currentMessageNumber ++;
    console.log('Message number send:', messageNumber);
    fetchAndSendRoute(dict['SEARCH'].substr(0, 1), dict['SEARCH'].substr(1), messageNumber);
    // Stop watching the position for automatic step updates if a new search is recived
    stopCurrentStepUpdates();
  }
});
