<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Provider
    |--------------------------------------------------------------------------
    | Where the classification model (TypeSafe's Jev) is called.
    | "typesafe": directly at api.typesafe.ai.
    | "vercel":   through the Vercel AI Gateway.
    */
    'provider' => env('BARD_ASSIST_PROVIDER', 'typesafe'),

    /*
    |--------------------------------------------------------------------------
    | API key
    |--------------------------------------------------------------------------
    | Without a key the editor shows a notice and makes no requests.
    | The key never reaches the browser; requests are proxied through the CP.
    */
    'api_key' => env('BARD_ASSIST_API_KEY', env('TYPESAFE_API_KEY')),

    /*
    |--------------------------------------------------------------------------
    | Endpoint and model
    |--------------------------------------------------------------------------
    | Leave null to use the provider's default.
    */
    'endpoint' => env('BARD_ASSIST_ENDPOINT'),

    'model' => env('BARD_ASSIST_MODEL'),

    // Seconds before a request to the provider is given up.
    'timeout' => 6,

    // Requests per user and minute through the control panel proxy.
    'rate_limit' => 600,

    /*
    |--------------------------------------------------------------------------
    | Threshold
    |--------------------------------------------------------------------------
    | Confidence (0 to 1) from which a suggestion is offered as the answer.
    | Below it, the editor asks which of the two likeliest sets it is.
    */
    'threshold' => 0.6,

    /*
    |--------------------------------------------------------------------------
    | Link targets
    |--------------------------------------------------------------------------
    | Entries a link field in a suggested set may point to.
    | collections: list of handles, or null for every collection with a route.
    | description_field: what tells the model what an entry is about;
    |   entries without it are described by their title alone.
    | limit: most entries offered to the model per request.
    */
    'targets' => [
        'collections' => null,
        'description_field' => 'description',
        'limit' => 100,
    ],

    /*
    |--------------------------------------------------------------------------
    | Live preview
    |--------------------------------------------------------------------------
    | The partial a suggested set is drawn with in the live preview.
    | {handle} is replaced by the set handle. When the partial does not exist,
    | the suggestion is simply not shown in the preview.
    */
    'preview' => [
        'partial' => 'partials/sets/{handle}',
    ],

];
