#pragma once
#include <pebble.h>

// Required functions
#include "colors.h"
#include "progress_layer.h"
#include "directions_draw.h"
// Required window interaction
#include "select_window.h"
#include "error_window.h"

enum SelectedType {
  Car = 0,
  Bike = 1,
  Train = 2,
  Walk = 3
};

// The transport type currently selected by the user (defined in directions_window.c)
extern int selected_type_enum;

void directions_window_push();
