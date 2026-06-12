#pragma once
#include <pebble.h>

// Required functions
#include "colors.h"

enum ErrorType {
  // Problem connection to phone
  Network = 0,
  // Error response from api
  Api = 1,
  // Error when trying to start the dictation
  Dictation = 2,
  // Error when a feature is unavailable
  Unavailable = 3,
  // Something simply went wrong
  Other = 4,
  // The phone could not reach the internet
  NoInternet = 5,
  // The phone could not determine the current position
  NoGps = 6,
  // The searched address was not found
  AddressNotFound = 7,
  // The route has more steps than the watch can show
  TooManySteps = 8,
  // No google api key was entered on the settings page
  NoApiKey = 9,
  // Google rejected the api key (bad key / quota / api not enabled)
  ApiKeyRejected = 10
};

void error_window_push(enum ErrorType);
