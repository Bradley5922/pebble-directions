// The google api key is configured by the user on the settings page and stored on the phone
function getGoogleApiKey() {
  try {
    return localStorage.getItem('googleApiKey') || '';
  } catch (e) {
    return '';
  }
}


// The error codes the watch understands (see the SETUP OVERVIEW in app.js)
var errorCodes = {
  noRoute: 1,
  tooManySteps: 2,
  noPosition: 3,
  addressNotFound: 4,
  noApiKey: 5,
  keyRejected: 6,
  noInternet: 7,
};

// Map a failed google response to an error code. The fallback is used for responses
// that are valid but contain no result (e.g. ZERO_RESULTS), since what that means
// depends on the request (address not found vs no route found).
function classifyApiError(networkError, res, fallback) {
  if (networkError) return errorCodes.noInternet;
  if (res && (res.status === 'REQUEST_DENIED' || res.status === 'OVER_QUERY_LIMIT' || res.status === 'OVER_DAILY_LIMIT')) {
    return errorCodes.keyRejected;
  }
  return fallback;
}

// Make a http request and return the recived json to the callback
// (callback params: success / json / networkError - the last one is true when the
// request itself failed, as opposed to a response that could not be parsed)
function makeJsonHttpGetRequest(url, callback, logResponseText) {
  // Create a request
  var request = new XMLHttpRequest();
  // Add a two minute timeout
  request.timeout = 120000;
  // Set up the requests callbacks
  request.onload = function() {
    // Send data to callback / error if json can not be parsed
    try {
      var data = JSON.parse(this.responseText);
      callback(true, data, false);
    } catch (e) {
      callback(false, null, false);
    }
    // Debugging helper stuff
    if (logResponseText) {
      console.log(this.responseText);
    }
  };
  request.onerror = function() {
    callback(false, null, true);
  };
  request.ontimeout = function() {
    callback(false, null, true);
  };
  // Fire the request
  request.open('GET', url);
  request.send();
}

// Return the current position to the callback (callback params: success / lat / lon)
function loadCurrentLocation(callback, retry) {
  navigator.geolocation.getCurrentPosition(
    // Success
    function(pos) {
      try {
        //callback(true, 52.5, 13.4); /* THIS IS FOR DEMO / SCREENSHOTS IN THE EMULATOR */
        if (pos.coords.accuracy <= 100 || retry !== true) {
          // Accuracy is good, use this location OR we should not retry!
          callback(true, pos.coords.latitude, pos.coords.longitude);
        } else if (retry === true) {
          // Try once more
          console.log('Will try to reload current location, accuracy:', pos.coords.accuracy);
          loadCurrentLocation(callback, false);
        }
      } catch (e) {
        // No location permission
        callback(false, 0, 0);
      }
    },
    // Error
    function() {
      callback(false, 0, 0);
    },
    // Options
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// Strip the html markup google returns in its instructions and decode the few entities it uses.
// Also normalises typographic unicode (curly quotes, dashes) to ascii, since the
// pebble system fonts can not render those characters and would show boxes.
function cleanInstruction(text) {
  if (!text) return '';
  return text
    .replace(/<\/div>/gi, '')            /* div close -> nothing */
    .replace(/<div[^>]*>/gi, '. ')       /* div open  -> sentence break (google appends extra info in a div) */
    .replace(/<[^>]+>/g, '')             /* drop any remaining tags */
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, ' to ')
    .replace(/\s+/g, ' ')                /* collapse whitespace */
    .replace(/^\s+|\s+$/g, '');          /* trim */
}

// Build a readable instruction for a public transport step using the transit_details google provides
function transitInstruction(step) {
  var td = step.transit_details;
  if (!td) return cleanInstruction(step.html_instructions);
  var line = td.line || {};
  var name = line.short_name || line.name || (line.vehicle && line.vehicle.name) || 'Transit';
  var text = name;
  if (td.headsign) text = text.concat(' towards ').concat(td.headsign);
  if (td.departure_stop && td.departure_stop.name) text = text.concat('. Board at ').concat(td.departure_stop.name);
  if (td.arrival_stop && td.arrival_stop.name) text = text.concat(', exit at ').concat(td.arrival_stop.name);
  if (td.num_stops) text = text.concat(' (').concat(td.num_stops).concat(' stops)');
  // Run through the cleaner, stop names can contain typographic unicode too
  return cleanInstruction(text);
}

// Map a google directions step to one of the pebble icon chars
function stepIcon(step, icons, mode) {
  // Transit steps (boarding a bus / train / tram) -> show the travel type icon
  if (step.travel_mode === 'TRANSIT') return icons.type;
  // Turn-by-turn manoeuvre takes priority (may be missing on the first / straight steps)
  var m = step.maneuver;
  if (m) {
    if (m.indexOf('uturn') !== -1) return m.indexOf('right') !== -1 ? icons.uRight : icons.uLeft;
    if (m.indexOf('left') !== -1) return icons.left;
    if (m.indexOf('right') !== -1) return icons.right;
    if (m === 'straight' || m.indexOf('merge') !== -1 || m.indexOf('ramp') !== -1) return icons.forward;
  }
  // No manoeuvre: a walking section of a transit route gets the forward arrow
  // (the travel type icon would show a train), everything else the type icon.
  if (mode === 'transit' && step.travel_mode === 'WALKING') return icons.forward;
  return icons.type;
}

// Determine the ccTLD region code of the current country (e.g. 'uk') and cache it on the
// phone. The region is used to bias the geocoder, so that e.g. searching 'Cambridge' from
// London finds Cambridge UK and not Cambridge Massachusetts. (callback param: region or '')
function loadRegionBias(lat, lon, callback) {
  // Use the cached region if we have not moved far (country changes are rare)
  try {
    var cache = JSON.parse(localStorage.getItem('regionBias'));
    if (cache && typeof cache.region === 'string' && getApproxDistance(lat, lon, cache.lat, cache.lon) < 100000) {
      return callback(cache.region);
    }
  } catch (e) {}
  // Reverse geocode the current position to country level
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?key=';
    url = url.concat(getGoogleApiKey());
    url = url.concat('&latlng=').concat(lat).concat(',').concat(lon);
    url = url.concat('&result_type=country');
  makeJsonHttpGetRequest(url, function(success, res) {
    var region = '';
    try {
      if (success && res.status === 'OK') {
        var iso = res.results[0].address_components[0].short_name;
        // The region param wants ccTLDs, which mostly match the iso codes (the UK is the notable exception)
        region = iso === 'GB' ? 'uk' : iso.toLowerCase();
        localStorage.setItem('regionBias', JSON.stringify({ lat: lat, lon: lon, region: region }));
      }
    } catch (e) {}
    // Never fail here, the region is only a nice-to-have bias
    callback(region);
  });
}

// Load a geolocation from google and return the found lat/lon to the callback
// (callback params: success / lat / lon / errorCode - set when success is false)
function loadLocationForSearch(searchText, currentLat, currentLon, callback) {
  // Bias the result towards a ~50 km box around the current position (mirrors the old 'prox' behaviour)
  var delta = 0.45;
  // Determine the country we are in to further bias the search
  loadRegionBias(currentLat, currentLon, function(region) {
    // Create the url
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?key=';
      url = url.concat(getGoogleApiKey());
      url = url.concat('&address=').concat(encodeURIComponent(searchText));
      url = url.concat('&bounds=')
               .concat(currentLat - delta).concat(',').concat(currentLon - delta)
               .concat('%7C') /* url encoded '|' */
               .concat(currentLat + delta).concat(',').concat(currentLon + delta);
      if (region) {
        url = url.concat('&region=').concat(region);
      }
    // Perform an request
    makeJsonHttpGetRequest(url, function(success, res, networkError) {
      if (success && res && res.status === 'OK') {
        // Success (will fail if expected fields are not available in response)
        try {
          // Google may return several matches, pick the one closest to the current position
          var best = null;
          var bestDistance = -1;
          res.results.forEach(function(result) {
            try {
              var location = result.geometry.location;
              var distance = getApproxDistance(currentLat, currentLon, location.lat, location.lng);
              if (best === null || distance < bestDistance) {
                best = location;
                bestDistance = distance;
              }
            } catch (e) {}
          });
          callback(true, best.lat, best.lng);
        } catch (e) {
          callback(false, 0, 0, errorCodes.addressNotFound);
        }
      } else {
        // Error
        if (res) console.log('Geocode failed:', res.status);
        callback(false, 0, 0, classifyApiError(networkError, res, errorCodes.addressNotFound));
      }
    });
  });
}

// Load a route from google and return the pebble-app conform data to the callback (callback params: success / data)
function loadRouteData(routeType, fromLat, fromLon, toLat, toLon, callback) {
  // Transport modes, mapped to pebble ids (0 = car, 1 = bike, 2 = train/transit, 3 = walk)
  var modes = ['driving', 'bicycling', 'transit', 'walking'];
  // Pebble direction icons, mapped to pebble ids (type = show nav type icon, attr = show attribution icon)
  var icons = {
    type: 'a',
    forward: 'b',
    right: 'c',
    left: 'd',
    uRight: 'e',
    uLeft: 'f',
    attr: 'g',
    final: 'h',
  };

  // Create the url
  var url = 'https://maps.googleapis.com/maps/api/directions/json?key=';
    url = url.concat(getGoogleApiKey());
    url = url.concat('&origin=').concat(fromLat).concat(',').concat(fromLon);
    url = url.concat('&destination=').concat(toLat).concat(',').concat(toLon);
    url = url.concat('&mode=').concat(modes[routeType]);
    url = url.concat('&units=metric');
    if (modes[routeType] === 'transit') {
      // Depart now for public transport routes
      url = url.concat('&departure_time=now');
    }
    // Log the final url (for rare use)
    //console.log(url);
  // Perform the request
  makeJsonHttpGetRequest(url, function(success, res, networkError) {
    if (success && res && res.status === 'OK') {
      // Success (will fail if expected fields are not available in response)
      try {
        // Our route data will go here. Format: { distance, time, stepList[string], stepIconsString[char] }
        var routeData = {};
        var leg = res.routes[0].legs[0];
        // Get the summary
        routeData.distance = leg.distance.value; /* in meters */
        routeData.time = Math.ceil(leg.duration.value / 60); /* in minutes */
        // Get the steps
        routeData.stepList = [];
        routeData.stepPositionList = [];
        routeData.stepIconsString = '';
        // Append one rendered step to the route (never an empty card)
        var pushStep = function(instruction, loc, icon) {
          routeData.stepList.push(instruction || 'Continue');
          routeData.stepPositionList.push({ lat: loc.lat, lon: loc.lng });
          routeData.stepIconsString = routeData.stepIconsString.concat(icon);
        };
        leg.steps.forEach(function(step) {
          if (step.travel_mode === 'TRANSIT') {
            // One card for the whole transit ride
            pushStep(transitInstruction(step), step.start_location, stepIcon(step, icons, modes[routeType]));
          } else if (step.travel_mode === 'WALKING' && step.steps && step.steps.length) {
            // Expand a walking leg into its turn-by-turn sub-steps. In a transit journey
            // these are the walk to / from the stop, which google only details here.
            step.steps.forEach(function(sub) {
              pushStep(cleanInstruction(sub.html_instructions), sub.start_location, stepIcon(sub, icons, modes[routeType]));
            });
          } else {
            // Driving / cycling / plain walking maneuver
            pushStep(cleanInstruction(step.html_instructions), step.start_location, stepIcon(step, icons, modes[routeType]));
          }
        });
        // Append an explicit arrival step so the final flag has its own entry
        routeData.stepList.push('Arrive at '.concat(cleanInstruction(leg.end_address)));
        routeData.stepPositionList.push({
          lat: leg.end_location.lat,
          lon: leg.end_location.lng,
        });
        routeData.stepIconsString = routeData.stepIconsString.concat(icons.final);
        // Add attribution (google's terms require crediting the data source)
        routeData.stepList.push('Directions powered by Google');
        routeData.stepIconsString = routeData.stepIconsString.concat(icons.attr);
        // We are done
        callback(true, routeData);
      } catch (e) {
        console.log(e);
        routeErrorCallback(callback, errorCodes.noRoute);
      }
    } else {
      // Error
      if (res) console.log('Directions failed:', res.status);
      routeErrorCallback(callback, classifyApiError(networkError, res, errorCodes.noRoute));
    }
  });
}

// Performs all the steps neccessary to return a complete route (the callback takes: success / route data)
function createRoute(routeType, searchText, callback) {
  // Make sure the user has configured a google api key on the settings page
  if (!getGoogleApiKey()) {
    console.log('No Google API key set - open the app settings on your phone and paste your key');
    return routeErrorCallback(callback, errorCodes.noApiKey);
  }
  // Load the current location
  loadCurrentLocation(function(successCurrentLocation, fromLat, fromLon) {
    console.log('current found:', fromLat, fromLon);
    if (successCurrentLocation) {
      // Geocode the search term
      loadLocationForSearch(searchText, fromLat, fromLon, function(successSearchLocation, toLat, toLon, searchErrorCode) {
        console.log('search found:', toLat, toLon);
        if (successSearchLocation) {
          // Load a route and pass it the callback (google handles every mode, transit included)
          loadRouteData(routeType, fromLat, fromLon, toLat, toLon, callback);
        } else {
          routeErrorCallback(callback, searchErrorCode);
        }
      });
    } else {
      routeErrorCallback(callback, errorCodes.noPosition);
    }
  }, true);
}
// Helper function to define createRoute error callback all in one place
// (the callback takes: success / route data / error code)
function routeErrorCallback(callback, errorCode) {
  callback(false, { distance: 0, time: 0, stepList: [], stepPositionList: [], stepIconsString: '' }, errorCode || errorCodes.noRoute);
}

// Calculates the distance of two sets of coordinates (in meters)
function getApproxDistance(fromLat, fromLon, toLat, toLon) {
  var p = 0.017453292519943295;    // Math.PI / 180
  var c = Math.cos;
  var a = 0.5 - c((fromLat - toLat) * p)/2 + c(toLat * p) * c(fromLat * p) * (1 - c((fromLon - toLon) * p))/2;

  return 12742000 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371000 m
}

// Determine the current waypoint index, based on a list of waypoint coords [{lat,lon},...], the current position, and the current index
function getCurrentStepIndex(steps, lat, lon, accuracy, currentIndex) {
  // Test if the accuracy is good enought
  if (accuracy > 50) return typeof currentIndex === 'number' ? currentIndex : 0;
  // Determine the current step
  try {
    // Determine the max distance
    var maxDistance = 30 + accuracy;
    // Loop through the steps and find the next one, that is close enought
    var foundIndex = currentIndex;
    steps.forEach(function(step, index) {
      // Test all upcoming waypoints
      if (index > currentIndex) {
        if (getApproxDistance(lat, lon, step.lat, step.lon) <= maxDistance) {
          // Move on to this waypoint
          foundIndex = index;
        }
      }
    });
    // Return the step found
    return foundIndex;
  } catch (e) {}

  // In case of an error, return 0 or the current index if it is a number
  return typeof currentIndex === 'number' ? currentIndex : 0;
}


// Exports
module.exports.createRoute = createRoute;
module.exports.getCurrentStepIndex = getCurrentStepIndex;
