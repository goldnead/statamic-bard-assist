<?php

use Goldnead\BardAssist\Http\Controllers\EvaluateController;
use Goldnead\BardAssist\Http\Controllers\SetController;
use Goldnead\BardAssist\Http\Controllers\TargetsController;
use Illuminate\Support\Facades\Route;

// Registered inside the CP route group: authenticated, CSRF-checked.
// evaluate, set and render additionally require the publish form's blueprint
// token and an opted-in Bard field. The "bard-assist" limiter is defined in
// the service provider (config: rate_limit).
Route::prefix('bard-assist')->name('bard-assist.')->group(function () {
    Route::post('evaluate', EvaluateController::class)->middleware('throttle:bard-assist')->name('evaluate');
    Route::get('targets', TargetsController::class)->name('targets');
    Route::post('set', [SetController::class, 'values'])->name('set');
    Route::post('render', [SetController::class, 'render'])->name('render');
});
