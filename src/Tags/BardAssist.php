<?php

namespace Goldnead\BardAssist\Tags;

use Statamic\Tags\Tags;

class BardAssist extends Tags
{
    protected static $handle = 'bard_assist';

    /**
     * {{ bard_assist:live_preview }} — put it at the end of the layout's <body>.
     *
     * Outputs a small script, and only inside a live preview request: it swaps
     * the preview's body in place (no iframe reload, no flicker) and lets the
     * control panel paint its suggestions into the new document first.
     */
    public function livePreview(): string
    {
        if (! request()->isLivePreview()) {
            return '';
        }

        return view('statamic-bard-assist::live-preview')->render();
    }
}
