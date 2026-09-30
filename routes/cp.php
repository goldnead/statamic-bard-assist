<?php

use Goldnead\BardAssist\Http\Controllers\EvaluateController;
use Goldnead\BardAssist\Http\Controllers\SetController;
use Goldnead\BardAssist\Http\Controllers\TargetsController;
use Illuminate\Support\Facades\Route;

// Registered inside the CP route group: authenticated, CSRF-checked.
// set/render additionally require the publish form's blueprint token.
Route::prefix('bard-assist')->name('bard-assist.')->group(function () {
    Route::post('evaluate', EvaluateController::class)->middleware('throttle:120,1')->name('evaluate');
    Route::get('targets', TargetsController::class)->name('targets');
    Route::post('set', [SetController::class, 'values'])->name('set');
    Route::post('render', [SetController::class, 'render'])->name('render');
});
