package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route

/** What Start round hands to the round (the web's pending round, truthy.pending.v1, kept in memory). */
data class RoundRequest(val route: Route, val mode: Mode)
